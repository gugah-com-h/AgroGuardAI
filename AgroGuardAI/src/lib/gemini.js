// Cliente do Gemini.
//
// Correções em relação à versão anterior:
//
// 1. `res.ok` não era verificado. Um 403 (chave revogada) ou 429 (cota) caía
//    no `throw new Error('empty')` genérico, o fallback repetia o mesmo erro,
//    e o usuário via "Não consegui gerar a análise" sem saber o motivo.
// 2. `clearTimeout` ficava depois do `await fetch`; se o fetch rejeitasse, o
//    timer vazava e podia abortar uma requisição posterior.
// 3. O histórico era truncado para a última resposta + última pergunta, então
//    o assistente esquecia a conversa a partir da terceira mensagem.
// 4. O prompt de sistema era injetado como um turno falso user/model. A API
//    tem `systemInstruction` para isso — é o uso correto e não gasta turnos.
// 5. O fallback disparava para qualquer erro, inclusive 400 (requisição
//    inválida), onde repetir não ajuda. Agora só troca de modelo quando faz
//    sentido (modelo indisponível, sobrecarga, timeout).

const CHAVE = import.meta.env.VITE_GEMINI_KEY;

// Modelos atuais recomendados pela documentação do Gemini. Ordem = preferência.
const MODELOS_PADRAO = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

const MODELOS = (import.meta.env.VITE_GEMINI_MODELS || '')
  .split(',').map((m) => m.trim()).filter(Boolean);

export const modelos = MODELOS.length ? MODELOS : MODELOS_PADRAO;

const ENDPOINT = (modelo) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

const TIMEOUT_MS = 20000;
const MAX_TURNOS = 20; // ~10 trocas; segura o custo sem amnésia na conversa

export class GeminiError extends Error {
  constructor(mensagem, { status = 0, recuperavel = false } = {}) {
    super(mensagem);
    this.name = 'GeminiError';
    this.status = status;
    this.recuperavel = recuperavel; // vale tentar o próximo modelo?
  }
}

export const temChave = Boolean(CHAVE);

function erroDeResposta(status, corpo) {
  const msgApi = corpo?.error?.message || '';

  if (status === 400 && /API key not valid/i.test(msgApi)) {
    return new GeminiError('A chave da API do Gemini é inválida. Confira o VITE_GEMINI_KEY no arquivo .env.', { status });
  }
  if (status === 400) {
    return new GeminiError(`O Gemini recusou a requisição: ${msgApi || 'requisição inválida'}.`, { status });
  }
  if (status === 403) {
    const vazou = /leaked/i.test(msgApi);
    return new GeminiError(
      vazou
        ? 'A chave do Gemini foi bloqueada pelo Google por ter sido exposta publicamente. Gere uma chave nova em aistudio.google.com/apikey.'
        : 'Acesso negado pelo Gemini. Verifique as restrições da chave no Google Cloud Console.',
      { status },
    );
  }
  if (status === 404) {
    return new GeminiError(`Modelo não encontrado no Gemini: ${msgApi}`, { status, recuperavel: true });
  }
  if (status === 429) {
    return new GeminiError('Limite de uso do Gemini atingido. Aguarde um instante e tente de novo.', { status, recuperavel: true });
  }
  if (status >= 500) {
    return new GeminiError('O Gemini está instável no momento.', { status, recuperavel: true });
  }
  return new GeminiError(msgApi || `Falha no Gemini (código ${status}).`, { status, recuperavel: true });
}

/** Converte o histórico da UI para o formato `contents` da API. */
function paraContents(historico) {
  return historico
    .slice(-MAX_TURNOS)
    .filter((m) => m.text?.trim())
    .map((m) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));
}

async function chamar(modelo, corpo, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), TIMEOUT_MS);
  const aoAbortar = () => ctrl.abort(signal.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener('abort', aoAbortar, { once: true });
  }

  try {
    const res = await fetch(ENDPOINT(modelo), {
      method: 'POST',
      // A chave vai no cabeçalho, não na query string: evita que ela apareça
      // em logs de servidor, histórico e no cabeçalho Referer.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CHAVE },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });

    let json = null;
    try { json = await res.json(); } catch { /* corpo não-JSON tratado abaixo */ }

    if (!res.ok) throw erroDeResposta(res.status, json);

    const candidato = json?.candidates?.[0];
    const texto = candidato?.content?.parts?.map((p) => p.text).filter(Boolean).join('') || '';

    if (!texto) {
      // Resposta vazia por filtro de segurança tem motivo declarado.
      const motivo = candidato?.finishReason;
      if (motivo === 'SAFETY') throw new GeminiError('A resposta foi bloqueada pelo filtro de segurança do Gemini.', { status: 200 });
      if (motivo === 'MAX_TOKENS') throw new GeminiError('A resposta foi cortada por tamanho. Faça uma pergunta mais específica.', { status: 200 });
      throw new GeminiError('O Gemini devolveu uma resposta vazia.', { status: 200, recuperavel: true });
    }
    return texto;
  } catch (erro) {
    if (erro instanceof GeminiError) throw erro;
    if (erro?.name === 'AbortError' && signal?.aborted) throw erro; // cancelamento nosso
    if (erro?.name === 'TimeoutError' || erro?.name === 'AbortError') {
      throw new GeminiError('O Gemini demorou demais para responder.', { status: 0, recuperavel: true });
    }
    throw new GeminiError('Não foi possível falar com o Gemini. Verifique sua conexão.', { status: 0, recuperavel: true });
  } finally {
    clearTimeout(timer); // sempre, inclusive quando o fetch rejeita
    if (signal) signal.removeEventListener('abort', aoAbortar);
  }
}

/**
 * Pergunta ao Gemini, percorrendo a cascata de modelos enquanto o erro for
 * recuperável. Erros definitivos (chave inválida/bloqueada) param na hora.
 *
 * @param {Array<{role:'ai'|'user', text:string}>} historico
 * @param {string} instrucaoSistema
 * @param {{ signal?: AbortSignal }} opcoes
 * @throws {GeminiError}
 */
export async function perguntarGemini(historico, instrucaoSistema, { signal } = {}) {
  if (!CHAVE) {
    throw new GeminiError(
      'O assistente está sem chave de API. Defina VITE_GEMINI_KEY no arquivo .env e reinicie o servidor.',
      { status: 0 },
    );
  }

  const contents = paraContents(historico);
  if (!contents.length) throw new GeminiError('Nada a perguntar.', { status: 0 });

  const corpo = {
    contents,
    systemInstruction: { parts: [{ text: instrucaoSistema }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 1600 },
  };

  let ultimoErro = null;
  for (const modelo of modelos) {
    try {
      return await chamar(modelo, corpo, signal);
    } catch (erro) {
      if (erro?.name === 'AbortError') throw erro; // cancelado: não tenta outro
      ultimoErro = erro;
      if (!(erro instanceof GeminiError) || !erro.recuperavel) throw erro;
    }
  }
  throw ultimoErro;
}

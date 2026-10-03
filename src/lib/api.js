// Cliente da API AgroGuard.
//
// Antes as páginas faziam `fetch(url).then(r => r.json())` sem checar
// `r.ok`. O FastAPI responde erro como `{"detail": "..."}` com status 4xx/5xx,
// então o corpo de erro era tratado como dado válido: um 404 em /score virava
// um objeto sem `indices`, e a tela quebrava ao ler `indices.fogo.score_F`.

const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');
const TIMEOUT_PADRAO = 120000; // /score pode levar ~45s no primeiro acesso a um estado

export class ApiError extends Error {
  constructor(mensagem, { status = 0, causa = null } = {}) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.causa = causa;
  }
}

/** Mensagens em português para o usuário final, não stack trace. */
function mensagemDoStatus(status, detalhe) {
  if (detalhe && typeof detalhe === 'string') return detalhe;
  if (status === 404) return 'Não encontramos dados para esta localização.';
  if (status === 400) return 'Localização inválida para esta consulta.';
  if (status >= 500) return 'O servidor de dados falhou. Tente novamente em instantes.';
  return `Falha na consulta (código ${status}).`;
}

/**
 * GET em um endpoint da API.
 * @param {string} caminho  ex.: '/estado/GO'
 * @param {{ signal?: AbortSignal, timeout?: number }} opcoes
 * @throws {ApiError}
 */
export async function apiGet(caminho, { signal, timeout = TIMEOUT_PADRAO } = {}) {
  const ctrl = new AbortController();
  const porTempo = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeout);
  // Encadeia o signal de fora (desmontagem do componente) com o do timeout.
  const aoAbortar = () => ctrl.abort(signal.reason);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener('abort', aoAbortar, { once: true });
  }

  try {
    const res = await fetch(`${BASE}${caminho}`, { signal: ctrl.signal, headers: { Accept: 'application/json' } });

    let corpo = null;
    try {
      corpo = await res.json();
    } catch {
      if (res.ok) throw new ApiError('O servidor respondeu em um formato inesperado.', { status: res.status });
    }

    if (!res.ok) {
      throw new ApiError(mensagemDoStatus(res.status, corpo?.detail), { status: res.status });
    }
    return corpo;
  } catch (erro) {
    if (erro instanceof ApiError) throw erro;
    // Abort externo (troca de rota/desmontagem): propaga para o chamador ignorar.
    if (erro?.name === 'AbortError' && signal?.aborted) throw erro;
    if (erro?.name === 'TimeoutError' || erro?.name === 'AbortError') {
      throw new ApiError('A consulta demorou demais e foi cancelada. Tente de novo.', { status: 0, causa: erro });
    }
    throw new ApiError('Não foi possível falar com o servidor. Verifique se a API está no ar.', { status: 0, causa: erro });
  } finally {
    clearTimeout(porTempo);
    if (signal) signal.removeEventListener('abort', aoAbortar);
  }
}

/** true quando o erro veio de um cancelamento nosso (troca de rota) e deve ser ignorado. */
export function foiCancelado(erro) {
  return erro?.name === 'AbortError';
}

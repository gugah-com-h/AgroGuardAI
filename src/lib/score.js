// Fonte única das faixas, rótulos e cores de score.
//
// Antes isso estava duplicado em MapaPericulosidade.jsx e ChatBot.jsx, com
// divergências. Dois problemas foram corrigidos aqui:
//
// 1. `statusFromScore(undefined)` caía em todos os `if (s <= N)` e retornava
//    "NÍVEL CRÍTICO DE PERIGO". Um erro de rede virava alarme falso de risco
//    máximo. Agora valor inválido tem estado próprio ("sem dados").
//
// 2. As cores antigas falhavam no contraste WCAG AA sobre branco:
//    #4caf50 = 2,78:1 · #ffc107 = 1,63:1 · #ff9800 = 2,16:1 (mínimo: 4,5:1).
//    A faixa "moderado" em âmbar era praticamente ilegível. As cores abaixo
//    mantêm a mesma leitura semântica (verde→vermelho) com ≥4,5:1.

export const COR = {
  muitoBaixo: '#1B5E20', // 7,87:1
  baixo: '#2E7D32', // 5,13:1
  moderado: '#836700', // 5,38:1
  alto: '#BF4F00', // 4,85:1
  critico: '#C62828', // 5,62:1
  semDados: '#6B6B6B', // 5,33:1
};

const valido = (s) => typeof s === 'number' && Number.isFinite(s);

/** Faixa de RISCO: score alto = pior. */
export function faixaRisco(s) {
  if (!valido(s)) return { nivel: 'sem-dados', texto: 'SEM DADOS DISPONÍVEIS', curto: 'Sem dados', cor: COR.semDados };
  if (s <= 20) return { nivel: 'muito-baixo', texto: 'MUITO BAIXO NÍVEL DE PERIGO', curto: 'Muito baixo', cor: COR.muitoBaixo };
  if (s <= 40) return { nivel: 'baixo', texto: 'BAIXO NÍVEL DE PERIGO', curto: 'Baixo', cor: COR.baixo };
  if (s <= 60) return { nivel: 'moderado', texto: 'NÍVEL MODERADO DE PERIGO', curto: 'Moderado', cor: COR.moderado };
  if (s <= 80) return { nivel: 'alto', texto: 'ALTO NÍVEL DE PERIGO', curto: 'Alto', cor: COR.alto };
  return { nivel: 'critico', texto: 'NÍVEL CRÍTICO DE PERIGO', curto: 'Crítico', cor: COR.critico };
}

/** Cor de RISCO isolada (para os cartões de sub-índice). */
export function corRisco(s) {
  return faixaRisco(s).cor;
}

/** Cor de APTIDÃO: escala invertida — score alto = melhor. */
export function corAptidao(s) {
  if (!valido(s)) return COR.semDados;
  if (s >= 80) return COR.muitoBaixo;
  if (s >= 60) return COR.baixo;
  if (s >= 40) return COR.moderado;
  if (s >= 20) return COR.alto;
  return COR.critico;
}

// Formatação pt-BR centralizada.
// Motivo: a API devolve floats crus (ex.: 8894.550366079999) e valores em
// reais sem formatação. Exibir isso direto polui a tela e o prompt da IA.

const NUM = new Intl.NumberFormat('pt-BR');
const NUM1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MOEDA = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});

const vazio = (v) => v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));

/** Inteiro com separador de milhar. `null`/`NaN` viram o fallback. */
export function inteiro(v, fallback = '—') {
  return vazio(v) ? fallback : NUM.format(Math.round(v));
}

/** Número com uma casa decimal. */
export function decimal(v, fallback = '—') {
  return vazio(v) ? fallback : NUM1.format(v);
}

/** Valor em reais, sem centavos (os valores aqui são sempre grandes). */
export function moeda(v, fallback = '—') {
  return vazio(v) ? fallback : MOEDA.format(v);
}

/** Percentual já em escala 0-100. */
export function percentual(v, fallback = '—') {
  return vazio(v) ? fallback : `${NUM1.format(v)}%`;
}

/**
 * Score 0-100 para exibição no cartão: inteiro quando redondo, senão 1 casa.
 * Evita "65" virar "65,0" e "65.04" virar "65,04".
 */
export function score(v, fallback = '—') {
  if (vazio(v)) return fallback;
  return Number.isInteger(v) ? String(v) : NUM1.format(v);
}

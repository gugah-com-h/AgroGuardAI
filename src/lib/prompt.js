// Monta a instrução de sistema enviada ao Gemini a partir da resposta de /score.
//
// Três erros de contrato com a API foram corrigidos aqui:
//
// 1. `data.lat` / `data.lon` não existem na resposta — as coordenadas vêm em
//    `data.coordenadas`. O prompt dizia literalmente "lat: undefined".
// 2. `indices.climatico.precipitacao` não existe; o campo é
//    `precipitacao_media`. A precipitação sempre saía como "N/A".
// 3. Números crus iam para o prompt (8894.550366079999 ha, valores em reais
//    sem formatação), o que polui o contexto e faz a IA repetir o lixo.

import { inteiro, decimal, moeda, percentual } from './format.js';

const ou = (v, alt = 'sem dado') => (v === null || v === undefined ? alt : v);

export function montarInstrucaoSistema(dados) {
  if (!dados) return '';

  const idx = dados.indices || {};
  const fogo = idx.fogo || {};
  const clima = idx.climatico || {};
  const agri = idx.agricola || {};
  const amb = idx.ambiental || {};
  const sisser = agri.sisser || {};
  const apt = dados.aptidao || {};
  const zarc = apt.zarc || {};
  const coord = dados.coordenadas || {};

  const linhas = [
    'Você é o assistente do AgroGuard AI, especialista em risco ambiental e aptidão agrícola no Brasil.',
    'Responda sempre em português do Brasil, de forma clara, objetiva e acessível a pequenos agricultores.',
    'Use parágrafos curtos. Destaque termos importantes com **negrito**.',
    '',
    `MUNICÍPIO: ${dados.municipio} – ${dados.uf}`,
    `Coordenadas consultadas: ${decimal(coord.lat)}, ${decimal(coord.lon)}`,
    '',
    `SCORE GERAL DE RISCO AMBIENTAL: ${ou(dados.score_geral)}/100 (${ou(dados.classe_risco)})`,
    `PRIORIDADE AGRÍCOLA: ${ou(dados.score_prioridade)}/100 (${ou(dados.classe_prioridade)})`,
    `Fórmula aplicada: ${ou(dados.formula_usada)}`,
    '',
    `ÍNDICE DE FOGO (F): ${ou(fogo.score_F)}/100`,
    `- Focos no ano: ${inteiro(fogo.focos_total_ano)}`,
    `- Focos nos últimos 30 dias: ${inteiro(fogo.focos_30d)}`,
    `- Focos nos últimos 7 dias: ${inteiro(fogo.focos_7d)}`,
    `- FRP médio: ${decimal(fogo.frp_medio)} MW · FRP máximo: ${decimal(fogo.frp_max)} MW`,
    `- Risco de fogo INPE: ${ou(fogo.rf_inpe_classe)} (${decimal(fogo.rf_inpe_medio)})`,
    '',
    `ÍNDICE CLIMÁTICO (C): ${ou(clima.score_C)}/100`,
    `- Dias sem chuva (média): ${decimal(clima.dias_sem_chuva)}`,
    `- Precipitação média: ${decimal(clima.precipitacao_media)} mm`,
    `- Risco de fogo meteorológico: ${decimal(clima.risco_fogo_meteo)}`,
    '',
    `ÍNDICE AGRÍCOLA (A): ${ou(agri.score_A)}/100`,
    `- Área irrigada: ${inteiro(agri.hectares_irrigados)} ha`,
    `- Pivôs centrais estimados: ${inteiro(agri.qtd_pivos_estimada)}`,
    sisser.tem_seguro
      ? `- Seguro rural (SISSER): ${inteiro(sisser.apolices)} apólices, ${inteiro(sisser.area_segurada_ha)} ha segurados, ${moeda(sisser.valor_segurado)} em valor segurado, ${inteiro(sisser.culturas_distintas)} culturas`
      : '- Seguro rural (SISSER): nenhuma apólice encontrada para este município',
    '',
    amb.score_S != null
      ? `ÍNDICE AMBIENTAL (S): ${amb.score_S}/100`
      : `ÍNDICE AMBIENTAL (S): ${ou(amb.nota, 'dados pendentes')} — o peso dele foi redistribuído entre os outros índices`,
    '',
    apt.score_aptidao != null
      ? [
          `APTIDÃO AGRÍCOLA (ZARC): ${apt.score_aptidao}/100 (${ou(apt.classe_aptidao?.[0], '')})`,
          `- Taxa de aptidão geral: ${percentual(zarc.taxa_aptidao)}`,
          `- Taxa de aptidão de sequeiro: ${percentual(zarc.taxa_aptidao_sequeiro)}`,
          `- Culturas aptas: ${inteiro(zarc.n_culturas_aptas)}`,
        ].join('\n')
      : 'APTIDÃO AGRÍCOLA (ZARC): sem dados para este município',
  ];

  if (dados.fatores_risco?.length) {
    linhas.push('', 'FATORES DE ATENÇÃO IDENTIFICADOS:', ...dados.fatores_risco.map((f) => `- ${f}`));
  }

  linhas.push(
    '',
    'ESCALAS: no risco ambiental, score alto = mais risco. Na aptidão (ZARC), score alto = melhor.',
    'Fontes: INPE BDQueimadas, ANA/Embrapa (pivôs centrais), MAPA SISSER e ZARC, IBGE.',
    '',
    'REGRAS:',
    '- Baseie-se somente nos dados acima. Não invente números.',
    '- Se um dado estiver marcado como ausente, diga que não há informação em vez de estimar.',
    '- Sua cobertura é apenas de municípios brasileiros. Se perguntarem sobre outro país, explique isso com educação.',
  );

  return linhas.join('\n');
}

/** Pergunta de abertura, feita automaticamente ao carregar o resultado. */
export function perguntaDeAbertura(dados) {
  return `Faça um resumo do risco ambiental e da aptidão agrícola de ${dados.municipio} – ${dados.uf}, destacando os principais fatores de atenção e o que o produtor deve observar.`;
}

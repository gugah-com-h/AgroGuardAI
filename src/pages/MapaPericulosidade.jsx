import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

import { aplicarIconePadrao } from '../lib/leafletIcone.js';
import { apiGet, foiCancelado } from '../lib/api.js';
import { perguntarGemini, temChave } from '../lib/gemini.js';
import { montarInstrucaoSistema, perguntaDeAbertura } from '../lib/prompt.js';
import { faixaRisco, corRisco, corAptidao } from '../lib/score.js';
import { inteiro, decimal, moeda, percentual, score as fmtScore } from '../lib/format.js';
import Mensagem from '../components/Mensagem.jsx';
import css from '../assets/css/resultado.css?inline';

aplicarIconePadrao();

/* ------------------------------ mapa de calor ------------------------------ */

function CamadaCalor({ pontos }) {
  const mapa = useMap();
  useEffect(() => {
    if (!pontos.length) return undefined;
    const camada = L.heatLayer(pontos, {
      radius: 18, blur: 22, maxZoom: 13, max: 1.0,
      gradient: { 0.2: '#ffffb2', 0.4: '#fecc5c', 0.6: '#fd8d3c', 0.8: '#f03b20', 1: '#bd0026' },
    }).addTo(mapa);
    return () => { mapa.removeLayer(camada); };
  }, [pontos, mapa]);
  return null;
}

/* ------------------------------ cartão de score ------------------------------ */

function CartaoScore({ rotulo, valor, cor, titulo }) {
  return (
    <div className="cartao-score" style={{ '--cor': cor }} title={titulo}>
      <span className="cartao-score__rotulo">{rotulo}</span>
      <span className="cartao-score__valor">{fmtScore(valor)}</span>
    </div>
  );
}

const IconeOk = ({ cor }) => (
  <svg viewBox="0 0 24 24" fill={cor} aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

const IconeAlerta = ({ cor }) => (
  <svg viewBox="0 0 24 24" fill={cor} aria-hidden="true">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </svg>
);

/* ------------------------------ página ------------------------------ */

export default function MapaPericulosidade() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const uf = (params.get('uf') || '').toUpperCase();
  const municipioParam = params.get('municipio') || '';

  // `parseFloat(x) || padrão` descartava a coordenada 0 e qualquer valor
  // inválido virava silenciosamente o centro de Goiás — o usuário recebia o
  // score de outro lugar sem perceber.
  const { lat, lon, coordsValidas } = useMemo(() => {
    const la = Number.parseFloat(params.get('lat'));
    const lo = Number.parseFloat(params.get('lon'));
    return {
      lat: Number.isFinite(la) ? la : -15.5,
      lon: Number.isFinite(lo) ? lo : -49.5,
      coordsValidas: Number.isFinite(la) && Number.isFinite(lo),
    };
  }, [params]);

  const [dados, setDados] = useState(null);
  const [erroDados, setErroDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [contorno, setContorno] = useState(null);
  const [pontosCalor, setPontosCalor] = useState([]);
  const [totalFocos, setTotalFocos] = useState(null);

  const [mensagens, setMensagens] = useState([]);
  const [entrada, setEntrada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const instrucao = useRef('');
  const fimDasMensagens = useRef(null);
  const areaTexto = useRef(null);
  const aberturaPedida = useRef(false);

  /* ---- contorno e focos ---- */
  useEffect(() => {
    if (!uf) return undefined;
    const ctrl = new AbortController();

    apiGet(`/focos/${uf}`, { signal: ctrl.signal })
      .then((lista) => {
        // Sem esta checagem, um corpo inesperado quebrava no `.map`.
        if (!Array.isArray(lista)) return;
        setTotalFocos(lista.length);
        setPontosCalor(
          lista
            .filter((f) => Number.isFinite(f?.latitude) && Number.isFinite(f?.longitude))
            .map((f) => [f.latitude, f.longitude, Number.isFinite(f.frp) ? Math.min(f.frp / 300, 1) : 0.5]),
        );
      })
      .catch((e) => { if (!foiCancelado(e)) console.warn('[AgroGuard] focos indisponíveis:', e.message); });

    apiGet(`/estado/${uf}`, { signal: ctrl.signal })
      .then((d) => { if (d?.contorno) setContorno(d.contorno); })
      .catch((e) => { if (!foiCancelado(e)) console.warn('[AgroGuard] contorno indisponível:', e.message); });

    return () => ctrl.abort();
  }, [uf]);

  /* ---- score do município ---- */
  useEffect(() => {
    if (!uf || !coordsValidas) return undefined;
    const ctrl = new AbortController();

    setCarregando(true);
    setErroDados(null);
    aberturaPedida.current = false;

    apiGet(`/score?lat=${lat}&lon=${lon}&uf=${uf}`, { signal: ctrl.signal })
      .then((d) => {
        setDados(d);
        instrucao.current = montarInstrucaoSistema(d);
        setCarregando(false);
      })
      .catch((erro) => {
        if (foiCancelado(erro)) return;
        setDados(null);
        setErroDados(erro.message);
        setCarregando(false);
      });

    return () => ctrl.abort();
  }, [uf, lat, lon, coordsValidas, tentativa]);

  /* ---- resumo automático da IA ----
     Em efeito separado e com trava: no StrictMode do React 19 o efeito roda
     duas vezes em desenvolvimento, e a versão anterior disparava duas
     chamadas pagas ao Gemini a cada abertura da tela. */
  useEffect(() => {
    if (!dados || aberturaPedida.current) return undefined;
    aberturaPedida.current = true;

    const ctrl = new AbortController();
    setEnviando(true);

    perguntarGemini(
      [{ role: 'user', text: perguntaDeAbertura(dados) }],
      instrucao.current,
      { signal: ctrl.signal },
    )
      .then((resposta) => setMensagens([{ role: 'ai', text: resposta }]))
      .catch((erro) => {
        if (erro?.name === 'AbortError') return;
        setMensagens([{ role: 'erro', text: erro.message }]);
      })
      .finally(() => { if (!ctrl.signal.aborted) setEnviando(false); });

    return () => ctrl.abort();
  }, [dados]);

  /* ---- rolagem automática ---- */
  useEffect(() => {
    fimDasMensagens.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [mensagens, enviando]);

  /* ---- envio de pergunta ---- */
  const enviar = useCallback(
    async (e) => {
      e?.preventDefault();
      const texto = entrada.trim();
      if (!texto || enviando || !dados) return;

      setEntrada('');
      if (areaTexto.current) areaTexto.current.style.height = 'auto';

      const historico = [...mensagens.filter((m) => m.role !== 'erro'), { role: 'user', text: texto }];
      setMensagens((prev) => [...prev, { role: 'user', text: texto }]);
      setEnviando(true);

      try {
        // O histórico completo vai junto: antes só a última resposta e a
        // última pergunta eram enviadas, então a IA perdia o fio da conversa.
        const resposta = await perguntarGemini(historico, instrucao.current);
        setMensagens((prev) => [...prev, { role: 'ai', text: resposta }]);
      } catch (erro) {
        setMensagens((prev) => [...prev, { role: 'erro', text: erro.message }]);
      } finally {
        setEnviando(false);
      }
    },
    [entrada, enviando, dados, mensagens],
  );

  const aoDigitar = (e) => {
    setEntrada(e.target.value);
    // A caixa tinha `max-height:120px` mas nunca crescia: a regra era morta.
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const aoTeclar = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  /* ---- derivados ---- */
  const faixa = faixaRisco(dados?.score_geral);
  const idx = dados?.indices;
  const apt = dados?.aptidao;
  const sisser = idx?.agricola?.sisser;
  const nomeMunicipio = dados?.municipio || municipioParam;
  const semRisco = !dados || typeof dados.score_geral !== 'number';

  // Chegar aqui sem estado nem coordenada deixava a tela em esqueleto eterno.
  if (!uf || !coordsValidas) return <Navigate to="/localizacao" replace />;

  return (
    <>
      <title>{`AgroGuard Ai — ${nomeMunicipio || 'Resultado'}`}</title>
      <style>{css}</style>

      <div className="pagina-resultado">
        {/* ------------------------------ MAPA ------------------------------ */}
        <div className="resultado__mapa">
          <MapContainer center={[lat, lon]} zoom={10} style={{ width: '100%', height: '100%' }} zoomControl keyboard>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
            {contorno && <GeoJSON data={contorno} style={{ color: '#3C7838', weight: 2, fillOpacity: 0.05, dashArray: '6 4' }} />}
            {pontosCalor.length > 0 && <CamadaCalor pontos={pontosCalor} />}
            <Marker position={[lat, lon]} alt={`Propriedade em ${nomeMunicipio || 'local selecionado'}`} />
          </MapContainer>

          <div className="resultado__info">
            <h2>{nomeMunicipio || 'Carregando…'}{uf ? ` – ${uf}` : ''}</h2>
            <p>
              {totalFocos === null
                ? 'Carregando focos de calor…'
                : `${inteiro(totalFocos)} focos de calor no estado`}
            </p>
          </div>

          {pontosCalor.length > 0 && (
            <div className="resultado__legenda">
              <span className="resultado__legenda-titulo">Focos de calor</span>
              <div className="resultado__legenda-escala">
                <span>menos</span>
                <span className="resultado__legenda-barra" aria-hidden="true" />
                <span>mais</span>
              </div>
            </div>
          )}

          <div
            className="resultado__status"
            style={{ borderLeftColor: carregando ? 'var(--score-sem-dados)' : faixa.cor }}
            role="status"
            aria-live="polite"
          >
            {carregando ? (
              <h2 style={{ color: 'var(--texto-suave)' }}>Calculando o risco…</h2>
            ) : erroDados ? (
              <h2 style={{ color: 'var(--erro)' }}>Não foi possível calcular</h2>
            ) : (
              <>
                <h2 style={{ color: faixa.cor }}>{faixa.texto}</h2>
                {faixa.nivel === 'muito-baixo' || faixa.nivel === 'baixo'
                  ? <IconeOk cor={faixa.cor} />
                  : <IconeAlerta cor={faixa.cor} />}
              </>
            )}
          </div>
        </div>

        {/* ------------------------------ PAINEL ------------------------------ */}
        <aside className={`resultado__painel${painelAberto ? ' aberto' : ''}`}>
          <button
            type="button"
            className="painel__puxador"
            onClick={() => setPainelAberto((v) => !v)}
            aria-expanded={painelAberto}
            aria-controls="painel-conteudo"
          >
            <span className="seta" aria-hidden="true">▲</span>
            <span>{painelAberto ? 'Fechar assistente' : 'Assistente IA'}</span>
          </button>

          <div className="painel__nova-mobile">
            <button type="button" onClick={() => navigate('/localizacao')}>Nova consulta</button>
          </div>

          <div className="painel__cabecalho">
            <h2>AgroGuard AI</h2>
            <button type="button" className="btn-nova" onClick={() => navigate('/localizacao')}>
              Nova consulta
            </button>
          </div>

          <div id="painel-conteudo" style={{ display: 'contents' }}>
            {erroDados ? (
              <div className="painel__falha" role="alert">
                <h3>Não conseguimos os dados deste ponto</h3>
                <p>{erroDados}</p>
                <div className="painel__falha-acoes">
                  <button type="button" onClick={() => setTentativa((t) => t + 1)}>Tentar de novo</button>
                  <button type="button" className="secundario" onClick={() => navigate('/localizacao')}>
                    Escolher outro local
                  </button>
                </div>
              </div>
            ) : (
              <>
                {carregando ? (
                  <div className="painel__scores">
                    {[1, 2, 3, 4, 5].map((i) => <div key={i} className="esqueleto-cartao" />)}
                  </div>
                ) : (
                  <div className="painel__scores">
                    <CartaoScore rotulo="Risco" valor={dados.score_geral} cor={faixa.cor}
                      titulo={`Risco ambiental geral: ${faixa.curto}`} />
                    <CartaoScore rotulo="Fogo" valor={idx?.fogo?.score_F} cor={corRisco(idx?.fogo?.score_F)}
                      titulo="Índice de fogo (focos de calor e intensidade)" />
                    <CartaoScore rotulo="Clima" valor={idx?.climatico?.score_C} cor={corRisco(idx?.climatico?.score_C)}
                      titulo="Índice climático (chuva e risco meteorológico)" />
                    <CartaoScore rotulo="Agrí" valor={idx?.agricola?.score_A} cor={corRisco(idx?.agricola?.score_A)}
                      titulo="Índice agrícola (irrigação e seguro rural)" />
                    {apt?.score_aptidao != null && (
                      <CartaoScore rotulo="ZARC" valor={apt.score_aptidao} cor={corAptidao(apt.score_aptidao)}
                        titulo={`Aptidão agrícola: ${apt.classe_aptidao?.[0] ?? ''} — nesta escala, maior é melhor`} />
                    )}
                  </div>
                )}

                {/* Os números brutos existiam na resposta mas só apareciam
                    dentro do texto da IA. Agora ficam acessíveis direto. */}
                {!carregando && dados && (
                  <details className="painel__dados">
                    <summary>Dados usados no cálculo</summary>
                    <dl>
                      <dt className="painel__dados-secao">Fogo</dt>
                      <dt>Focos nos últimos 7 dias</dt><dd>{inteiro(idx?.fogo?.focos_7d)}</dd>
                      <dt>Focos nos últimos 30 dias</dt><dd>{inteiro(idx?.fogo?.focos_30d)}</dd>
                      <dt>Focos no ano</dt><dd>{inteiro(idx?.fogo?.focos_total_ano)}</dd>
                      <dt>FRP máximo</dt><dd>{decimal(idx?.fogo?.frp_max)} MW</dd>
                      <dt>Risco de fogo INPE</dt><dd>{idx?.fogo?.rf_inpe_classe ?? '—'}</dd>

                      <dt className="painel__dados-secao">Clima</dt>
                      <dt>Dias sem chuva</dt><dd>{decimal(idx?.climatico?.dias_sem_chuva)}</dd>
                      <dt>Precipitação média</dt><dd>{decimal(idx?.climatico?.precipitacao_media)} mm</dd>

                      <dt className="painel__dados-secao">Agricultura</dt>
                      <dt>Área irrigada</dt><dd>{inteiro(idx?.agricola?.hectares_irrigados)} ha</dd>
                      <dt>Pivôs estimados</dt><dd>{inteiro(idx?.agricola?.qtd_pivos_estimada)}</dd>
                      {sisser?.tem_seguro && (
                        <>
                          <dt>Apólices de seguro</dt><dd>{inteiro(sisser.apolices)}</dd>
                          <dt>Área segurada</dt><dd>{inteiro(sisser.area_segurada_ha)} ha</dd>
                          <dt>Valor segurado</dt><dd>{moeda(sisser.valor_segurado)}</dd>
                        </>
                      )}

                      {apt?.zarc && (
                        <>
                          <dt className="painel__dados-secao">Aptidão (ZARC)</dt>
                          <dt>Taxa de aptidão</dt><dd>{percentual(apt.zarc.taxa_aptidao)}</dd>
                          <dt>Aptidão de sequeiro</dt><dd>{percentual(apt.zarc.taxa_aptidao_sequeiro)}</dd>
                          <dt>Culturas aptas</dt><dd>{inteiro(apt.zarc.n_culturas_aptas)}</dd>
                        </>
                      )}
                    </dl>
                  </details>
                )}

                <div className="painel__mensagens" aria-live="polite" aria-busy={enviando}>
                  {carregando && (
                    <>
                      <div className="esqueleto-balao" style={{ width: '80%' }} />
                      <div className="esqueleto-balao" style={{ width: '60%' }} />
                      <div className="esqueleto-balao" style={{ width: '70%' }} />
                    </>
                  )}

                  {!carregando && !temChave && mensagens.length === 0 && (
                    <div className="msg msg--erro">
                      <strong>Assistente indisponível</strong>
                      Defina a variável VITE_GEMINI_KEY no arquivo .env e reinicie o servidor
                      para habilitar as respostas da IA. Os scores acima continuam válidos.
                    </div>
                  )}

                  {mensagens.map((msg, i) => (
                    <div
                      key={i}
                      className={`msg ${msg.role === 'ai' ? 'msg--ia' : msg.role === 'erro' ? 'msg--erro' : 'msg--usuario'}`}
                    >
                      {msg.role === 'erro' ? (
                        <>
                          <strong>Não foi possível responder</strong>
                          {msg.text}
                        </>
                      ) : (
                        <Mensagem texto={msg.text} />
                      )}
                    </div>
                  ))}

                  {enviando && (
                    <div className="msg msg--ia msg--pensando">Pensando…</div>
                  )}

                  <div ref={fimDasMensagens} />
                </div>

                <form className="painel__envio" onSubmit={enviar}>
                  <label htmlFor="pergunta" className="so-leitor-tela">
                    Pergunte sobre os dados deste município
                  </label>
                  <textarea
                    id="pergunta"
                    ref={areaTexto}
                    placeholder={semRisco ? 'Aguardando os dados…' : 'Pergunte sobre os dados…'}
                    rows={1}
                    value={entrada}
                    onChange={aoDigitar}
                    onKeyDown={aoTeclar}
                    disabled={semRisco || carregando}
                  />
                  <button
                    type="submit"
                    className="btn-enviar"
                    title="Enviar pergunta"
                    aria-label="Enviar pergunta"
                    disabled={enviando || semRisco || !entrada.trim()}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

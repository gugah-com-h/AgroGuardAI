import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY;
const GEMINI_PRIMARY = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=' + GEMINI_KEY;
const GEMINI_FALLBACK = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY;
const TIMEOUT_MS = 10000;

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function HeatLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const heat = L.heatLayer(points, {
      radius: 18, blur: 22, maxZoom: 13, max: 1.0,
      gradient: { 0.2: '#ffffb2', 0.4: '#fecc5c', 0.6: '#fd8d3c', 0.8: '#f03b20', 1: '#bd0026' }
    }).addTo(map);
    return () => map.removeLayer(heat);
  }, [points, map]);
  return null;
}

function ScoreCard({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, background: '#fff',
      borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid ' + color,
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
    }}>
      <span style={{ fontSize: '.7rem', color: '#888', fontFamily: "'Courier Prime', monospace" }}>{label}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: 700, color, fontFamily: "'Montserrat', sans-serif" }}>{value}</span>
    </div>
  );
}

function corScore(s) {
  if (s <= 20) return '#1b5e20';
  if (s <= 40) return '#4caf50';
  if (s <= 60) return '#ffc107';
  if (s <= 80) return '#ff9800';
  return '#d32f2f';
}

function corAptidao(s) {
  if (s >= 80) return '#1b5e20';
  if (s >= 60) return '#4caf50';
  if (s >= 40) return '#ffc107';
  if (s >= 20) return '#ff9800';
  return '#d32f2f';
}

function buildSystemPrompt(data) {
  if (!data) return '';
  const idx = data.indices;
  const apt = data.aptidao;
  return 'Você é o assistente AgroGuard AI, especialista em riscos agrícolas e ambientais no Brasil.\n' +
    'Responda sempre em português, de forma clara e objetiva.\n\n' +
    'Dados do município ' + data.municipio + ' – ' + data.uf + ' (lat: ' + data.lat + ', lon: ' + data.lon + '):\n\n' +
    'SCORE GERAL DE RISCO AMBIENTAL: ' + data.score_geral + '/100 (' + data.classe_risco + ')\n' +
    'Prioridade agrícola: ' + data.score_prioridade + '/100 (' + data.classe_prioridade + ')\n\n' +
    'ÍNDICE DE FOGO (F): ' + idx.fogo.score_F + '/100\n' +
    '- Focos totais no período: ' + idx.fogo.focos_total_ano + '\n' +
    '- Focos últimos 30 dias: ' + idx.fogo.focos_30d + '\n' +
    '- Focos últimos 7 dias: ' + idx.fogo.focos_7d + '\n' +
    '- FRP máximo: ' + (idx.fogo.frp_max ?? 'N/A') + ' MW\n' +
    '- FRP médio: ' + (idx.fogo.frp_medio ?? 'N/A') + ' MW\n\n' +
    'ÍNDICE CLIMÁTICO (C): ' + idx.climatico.score_C + '/100\n' +
    '- Dias sem chuva: ' + (idx.climatico.dias_sem_chuva ?? 'N/A') + '\n' +
    '- Precipitação: ' + (idx.climatico.precipitacao ?? 'N/A') + ' mm\n\n' +
    'ÍNDICE AGRÍCOLA (A): ' + idx.agricola.score_A + '/100\n' +
    '- Hectares irrigados: ' + idx.agricola.hectares_irrigados + '\n' +
    '- Pivôs estimados: ' + idx.agricola.qtd_pivos_estimada + '\n' +
    '- Seguro rural (SISSER): ' + (idx.agricola.sisser?.tem_seguro ? 'Sim - ' + idx.agricola.sisser.apolices + ' apólices, ' + idx.agricola.sisser.area_segurada_ha + ' ha, R$ ' + idx.agricola.sisser.valor_segurado : 'Não encontrado') + '\n\n' +
    (apt?.score_aptidao != null ? 'APTIDÃO AGRÍCOLA (ZARC): ' + apt.score_aptidao + '/100 (' + (apt.classe_aptidao?.[0] ?? '') + ')\n- Taxa aptidão geral: ' + (apt.zarc?.taxa_aptidao ?? 'N/A') + '%\n- Taxa aptidão sequeiro: ' + (apt.zarc?.taxa_aptidao_sequeiro ?? 'N/A') + '%\n- Culturas aptas: ' + (apt.zarc?.n_culturas_aptas ?? 'N/A') : 'APTIDÃO AGRÍCOLA: Dados não disponíveis') + '\n\n' +
    (data.fatores_risco?.length ? 'FATORES DE ATENÇÃO:\n' + data.fatores_risco.map(function(f) { return '- ' + f; }).join('\n') : '') + '\n\n' +
    'Fontes: INPE BDQueimadas, ANA/Embrapa (pivôs), MAPA SISSER/ZARC, IBGE.\n' +
    'Use esses dados para responder as perguntas do usuário. Seja específico com números. Não invente dados.\n' +
    'IMPORTANTE: Seus dados cobrem APENAS municípios brasileiros. Se o usuário perguntar sobre locais fora do Brasil, informe educadamente que o AgroGuard cobre apenas o território brasileiro.';
}

async function askGemini(history, sysPrompt, isFirst) {
  var contents = [];
  contents.push({ role: 'user', parts: [{ text: sysPrompt }] });
  contents.push({ role: 'model', parts: [{ text: 'Entendido. Estou pronto para responder sobre os dados deste município.' }] });

  if (isFirst || history.length <= 2) {
    history.forEach(function(msg) {
      contents.push({ role: msg.role === 'ai' ? 'model' : 'user', parts: [{ text: msg.text }] });
    });
  } else {
    var lastAi = history.slice().reverse().find(function(m) { return m.role === 'ai'; });
    var lastUser = history[history.length - 1];
    if (lastAi) contents.push({ role: 'model', parts: [{ text: '[Resumo da conversa anterior]\n' + lastAi.text }] });
    contents.push({ role: 'user', parts: [{ text: lastUser.text }] });
  }

  var body = JSON.stringify({ contents });
  var opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body };

  async function callWithTimeout(url, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, ms);
    var res = await fetch(url, Object.assign({}, opts, { signal: ctrl.signal }));
    clearTimeout(timer);
    var json = await res.json();
    var text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('empty');
    return text;
  }

  try {
    return await callWithTimeout(GEMINI_PRIMARY, TIMEOUT_MS);
  } catch (e) {
    return await callWithTimeout(GEMINI_FALLBACK, TIMEOUT_MS * 2);
  }
}

var chatPageStyles = '\
.chat-page { display:flex; width:100vw; height:100vh; overflow:hidden; font-family:"Courier Prime",monospace; }\
.map-side { flex:1; position:relative; }\
.map-side .leaflet-container { width:100%; height:100%; }\
.chat-side { width:400px; height:100vh; display:flex; flex-direction:column; background:#F0F0F0; border-left:1px solid #ddd; position:relative; z-index:10; }\
.chat-header { padding:14px 16px; background:#488E43; color:#fff; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; }\
.chat-header h2 { font-family:"Montserrat",sans-serif; font-size:1rem; font-weight:800; margin:0; }\
.chat-header .btn-nova { background:#fff; color:#488E43; border:none; padding:6px 14px; border-radius:20px; font-family:"Courier Prime",monospace; font-size:.8rem; font-weight:700; cursor:pointer; transition:opacity .2s; }\
.chat-header .btn-nova:hover { opacity:.85; }\
.score-bar { display:flex; gap:6px; padding:10px 12px; flex-wrap:wrap; border-bottom:1px solid #ddd; flex-shrink:0; background:#f7f7f7; }\
.chat-msgs { flex:1; padding:16px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }\
.msg { max-width:85%; padding:12px 16px; font-size:.88rem; line-height:1.45; box-shadow:0 1px 3px rgba(0,0,0,.06); word-break:break-word; }\
.msg-ai { align-self:flex-start; background:#D9D9D9; color:#222; border-radius:12px 12px 12px 0; }\
.msg-user { align-self:flex-end; background:#C1D89D; color:#1F521B; border-radius:12px 12px 0 12px; }\
.chat-bar { background:#D9D9D9; padding:10px 14px; display:flex; align-items:flex-end; gap:10px; flex-shrink:0; }\
.chat-bar textarea { flex:1; min-height:40px; max-height:100px; background:#E8E8E8; border:none; border-radius:20px; padding:10px 16px; font-family:"Courier Prime",monospace; font-size:.88rem; color:#333; outline:none; resize:none; line-height:1.4; }\
.chat-bar textarea::placeholder { color:#999; }\
.chat-bar .send { width:40px; height:40px; border-radius:50%; background:#fff; border:none; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#488E43; box-shadow:0 1px 4px rgba(0,0,0,.1); transition:background .2s,color .2s; }\
.chat-bar .send:hover { background:#488E43; color:#fff; }\
@keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }\
.skel-card { flex:1 1 80px; min-width:80px; height:40px; border-radius:8px; background:linear-gradient(90deg,#e0e0e0 25%,#ececec 50%,#e0e0e0 75%); background-size:800px 100%; animation:shimmer 1.5s infinite; }\
.skel-bubble { height:50px; border-radius:12px 12px 12px 0; background:linear-gradient(90deg,#ddd 25%,#e8e8e8 50%,#ddd 75%); background-size:800px 100%; animation:shimmer 1.5s infinite; }\
.map-overlay { position:absolute; top:16px; left:16px; z-index:1000; background:rgba(255,255,255,.92); backdrop-filter:blur(6px); padding:10px 16px; border-radius:10px; box-shadow:0 2px 10px rgba(0,0,0,.15); }\
.map-overlay h3 { margin:0 0 2px; font-family:"Montserrat",sans-serif; font-size:.95rem; font-weight:800; color:#1F521B; }\
.map-overlay p { margin:0; font-size:.75rem; color:#555; }\
\
.mobile-chat-toggle { display:none; }\
\
@media(max-width:768px) {\
  .chat-page { flex-direction:column; }\
  .map-side { flex:1; width:100%; }\
  .chat-side { position:fixed; bottom:0; left:0; right:0; height:60vh; border-radius:20px 20px 0 0; border-left:none; border-top:1px solid #ccc; box-shadow:0 -4px 20px rgba(0,0,0,.15); transform:translateY(calc(100% - 56px)); transition:transform .35s ease; z-index:1000; }\
  .chat-side.expanded { transform:translateY(0); }\
  .mobile-chat-toggle { display:flex; align-items:center; justify-content:center; gap:8px; padding:14px 0; cursor:pointer; background:#488E43; color:#fff; border-radius:20px 20px 0 0; font-family:"Montserrat",sans-serif; font-weight:700; font-size:.85rem; user-select:none; flex-shrink:0; }\
  .mobile-chat-toggle .chevron { transition:transform .3s; font-size:1.1rem; }\
  .chat-side.expanded .mobile-chat-toggle .chevron { transform:rotate(180deg); }\
  .chat-header { display:none; }\
  .map-side { height:100vh; }\
}';

export default function ChatBot() {
  var navigate = useNavigate();
  var [params] = useSearchParams();
  var uf = params.get('uf') || '';
  var municipio = params.get('municipio') || '';
  var lat = parseFloat(params.get('lat')) || -15.5;
  var lon = parseFloat(params.get('lon')) || -49.5;

  var [score, setScore] = useState(null);
  var [loading, setLoading] = useState(true);
  var [messages, setMessages] = useState([]);
  var [input, setInput] = useState('');
  var [sending, setSending] = useState(false);
  var [heatPoints, setHeatPoints] = useState([]);
  var [contorno, setContorno] = useState(null);
  var [chatOpen, setChatOpen] = useState(false);
  var sysPrompt = useRef('');
  var messagesEnd = useRef(null);

  useEffect(function() {
    if (!uf) return;
    fetch('/api/focos/' + uf)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var pts = data.map(function(f) {
          return [f.latitude, f.longitude, f.frp ? Math.min(f.frp / 300, 1) : 0.5];
        });
        setHeatPoints(pts);
      })
      .catch(function() {});

    fetch('/api/estado/' + uf)
      .then(function(r) { return r.json(); })
      .then(function(data) { if (data.contorno) setContorno(data.contorno); })
      .catch(function() {});
  }, [uf]);

  useEffect(function() {
    if (!uf || !lat || !lon) return;
    fetch('/api/score?lat=' + lat + '&lon=' + lon + '&uf=' + uf)
      .then(function(r) { return r.json(); })
      .then(async function(data) {
        setScore(data);
        sysPrompt.current = buildSystemPrompt(data);
        var introReq = [{ role: 'user', text: 'Apresente um resumo completo dos dados de risco ambiental e aptidão agrícola de ' + data.municipio + ' \u2013 ' + data.uf + ', destacando os principais fatores de atenção.' }];
        try {
          var reply = await askGemini(introReq, sysPrompt.current, true);
          setMessages([{ role: 'ai', text: reply }]);
        } catch (e) {
          setMessages([{ role: 'ai', text: 'N\u00e3o consegui gerar a an\u00e1lise. Tente perguntar algo!' }]);
        }
        setLoading(false);
      })
      .catch(function() {
        setLoading(false);
        setMessages([{ role: 'ai', text: 'N\u00e3o consegui carregar os dados do munic\u00edpio.' }]);
      });
  }, [uf, lat, lon]);

  useEffect(function() {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  var handleSubmit = async function(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    var userMsg = input.trim();
    setInput('');
    var newMessages = messages.concat([{ role: 'user', text: userMsg }]);
    setMessages(newMessages);
    setSending(true);
    try {
      var reply = await askGemini(newMessages, sysPrompt.current, false);
      setMessages(function(prev) { return prev.concat([{ role: 'ai', text: reply }]); });
    } catch (e) {
      setMessages(function(prev) { return prev.concat([{ role: 'ai', text: 'Erro ao consultar a IA. Tente novamente.' }]); });
    }
    setSending(false);
  };

  var handleKeyDown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form.requestSubmit();
    }
  };

  var idx = score?.indices;
  var apt = score?.aptidao;

  var renderBold = function(text) {
    return text.split(/(\*\*.*?\*\*)/g).map(function(part, j) {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      <title>AgroGuard Ai - Assistente</title>
      <style>{chatPageStyles}</style>

      <div className="chat-page">
        {/* MAPA COM HEATMAP */}
        <div className="map-side">
          <MapContainer center={[lat, lon]} zoom={10} style={{ width: '100%', height: '100%' }} zoomControl={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
            <Marker position={[lat, lon]} />
            {contorno && <GeoJSON data={contorno} style={{ color: '#488E43', weight: 2, fillOpacity: 0.05, dashArray: '6 4' }} />}
            {heatPoints.length > 0 && <HeatLayer points={heatPoints} />}
          </MapContainer>

          {/* Info overlay no mapa */}
          <div className="map-overlay">
            <h3>{municipio || 'Carregando...'} {uf ? ' \u2013 ' + uf : ''}</h3>
            <p>{heatPoints.length > 0 ? heatPoints.length + ' focos de calor' : 'Carregando focos...'}</p>
          </div>
        </div>

        {/* CHAT LATERAL */}
        <div className={'chat-side' + (chatOpen ? ' expanded' : '')}>
          {/* Toggle mobile */}
          <div className="mobile-chat-toggle" onClick={function() { setChatOpen(function(v) { return !v; }); }}>
            <span className="chevron">{'\u25B2'}</span>
            <span>Assistente IA</span>
          </div>

          {/* Header desktop */}
          <div className="chat-header">
            <h2>AgroGuard AI</h2>
            <button className="btn-nova" onClick={function() { navigate('/localizacao'); }}>Nova Consulta</button>
          </div>

          {/* Score cards */}
          {loading ? (
            <div className="score-bar">
              {[1,2,3,4,5].map(function(i) { return <div key={i} className="skel-card" />; })}
            </div>
          ) : score && (
            <div className="score-bar">
              <ScoreCard label="Risco" value={score.score_geral} color={corScore(score.score_geral)} />
              <ScoreCard label="Fogo" value={idx.fogo.score_F} color={corScore(idx.fogo.score_F)} />
              <ScoreCard label="Clima" value={idx.climatico.score_C} color={corScore(idx.climatico.score_C)} />
              <ScoreCard label="Agri" value={idx.agricola.score_A} color={corScore(idx.agricola.score_A)} />
              {apt?.score_aptidao != null && (
                <ScoreCard label="ZARC" value={apt.score_aptidao} color={corAptidao(apt.score_aptidao)} />
              )}
            </div>
          )}

          {/* Messages */}
          <div className="chat-msgs">
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="skel-bubble" style={{ width: '80%' }} />
                <div className="skel-bubble" style={{ width: '60%' }} />
                <div className="skel-bubble" style={{ width: '70%' }} />
              </div>
            )}
            {messages.map(function(msg, i) {
              return (
                <div key={i} className={'msg ' + (msg.role === 'ai' ? 'msg-ai' : 'msg-user')}>
                  <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{renderBold(msg.text)}</p>
                </div>
              );
            })}
            {sending && (
              <div className="msg msg-ai">
                <p style={{ color: '#999', margin: 0 }}>Pensando...</p>
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* Input */}
          <form className="chat-bar" onSubmit={handleSubmit}>
            <textarea
              placeholder="Pergunte sobre os dados..."
              rows="1"
              value={input}
              onChange={function(e) { setInput(e.target.value); }}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" className="send" title="Enviar" disabled={sending}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

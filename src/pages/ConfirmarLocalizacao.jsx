import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { aplicarIconePadrao } from '../lib/leafletIcone.js';
import { apiGet, foiCancelado } from '../lib/api.js';
import { pontoNoContorno, dentroDoBrasil, limitesDoContorno } from '../lib/geo.js';
import { decimal } from '../lib/format.js';
import css from '../assets/css/confirmarMapa.css?inline';
import iconeCheck from '../assets/img/icons/check-lg.svg';

aplicarIconePadrao();

/** Move o pino ao clicar em qualquer ponto do mapa. */
function CliqueNoMapa({ aoMover }) {
  useMapEvents({
    click: (e) => {
      if (dentroDoBrasil(e.latlng.lat, e.latlng.lng)) aoMover([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/**
 * Enquadra o estado assim que o contorno chega.
 * Antes o mapa abria num zoom fixo 11 sobre o centroide: em estados grandes o
 * usuário via um pedaço do nada, sem referência de onde estava.
 */
function EnquadrarEstado({ contorno }) {
  const mapa = useMap();
  const jaEnquadrou = useRef(false);

  useEffect(() => {
    if (!contorno || jaEnquadrou.current) return;
    const limites = limitesDoContorno(contorno);
    if (!limites) return;
    mapa.fitBounds(limites, { padding: [48, 48], maxZoom: 11 });
    jaEnquadrou.current = true;
  }, [contorno, mapa]);

  return null;
}

const IconeAlerta = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </svg>
);

export default function ConfirmarLocalizacao() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const uf = (params.get('uf') || '').toUpperCase();
  const municipio = params.get('municipio') || '';

  // `parseFloat(x) || padrão` trocava a coordenada 0 pelo padrão. Aqui o
  // fallback só entra quando o número realmente não é válido.
  const coordInicial = useMemo(() => {
    const lat = Number.parseFloat(params.get('lat'));
    const lon = Number.parseFloat(params.get('lon'));
    return [Number.isFinite(lat) ? lat : -15.5, Number.isFinite(lon) ? lon : -49.5];
  }, [params]);

  const [pos, setPos] = useState(coordInicial);
  const [contorno, setContorno] = useState(null);

  useEffect(() => {
    if (!uf) return;
    const ctrl = new AbortController();
    apiGet(`/estado/${uf}`, { signal: ctrl.signal })
      .then((dados) => { if (dados?.contorno) setContorno(dados.contorno); })
      .catch((erro) => { if (!foiCancelado(erro)) console.warn('[AgroGuard] contorno indisponível:', erro.message); });
    return () => ctrl.abort();
  }, [uf]);

  // Validação que não existia: o usuário podia cravar o pino em outro estado
  // e só descobrir na tela seguinte, com um erro genérico.
  const dentroDoEstado = useMemo(
    () => pontoNoContorno(pos[0], pos[1], contorno),
    [pos, contorno],
  );
  const foraDoEstado = dentroDoEstado === false;

  const marcadorArrastavel = useMemo(
    () => ({
      dragend(e) {
        const { lat, lng } = e.target.getLatLng();
        if (dentroDoBrasil(lat, lng)) setPos([lat, lng]);
        else e.target.setLatLng(pos); // devolve o pino se saiu do Brasil
      },
    }),
    [pos],
  );

  const confirmar = useCallback(() => {
    if (foraDoEstado) return;
    navigate(
      `/mapa?${new URLSearchParams({
        uf, municipio, lat: String(pos[0]), lon: String(pos[1]),
      })}`,
    );
  }, [foraDoEstado, navigate, uf, municipio, pos]);

  // Acesso direto a /confirmar-localizacao sem estado não tem o que confirmar.
  if (!uf) return <Navigate to="/localizacao" replace />;

  return (
    <>
      <title>AgroGuard Ai — Confirme sua localização</title>
      <style>{css}</style>

      <main className="pagina-confirmar">
        <header className="pagina-confirmar__cabecalho">
          <span className="pagina-confirmar__selo">AgroGuard Ai</span>
          <h1>Confirme sua localização</h1>
          <p>Clique no mapa ou arraste o pino até a área exata da sua propriedade.</p>

          <span className="pagina-confirmar__local">
            {municipio ? <><strong>{municipio}</strong> – {uf} · </> : null}
            <span aria-live="polite">{decimal(pos[0])}, {decimal(pos[1])}</span>
          </span>

          {foraDoEstado && (
            <p className="pagina-confirmar__alerta" role="alert">
              <IconeAlerta />
              <span>
                Este ponto está fora de {uf}. Mova o pino para dentro do estado selecionado
                — os dados de risco são calculados por município.
              </span>
            </p>
          )}
        </header>

        <div className="pagina-confirmar__mapa">
          <MapContainer
            center={coordInicial}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            zoomControl
            /* O teclado agora move e dá zoom no mapa (antes, impossível sem mouse) */
            keyboard
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={19}
            />
            {contorno && (
              <GeoJSON
                data={contorno}
                style={{ color: '#3C7838', weight: 2, fillOpacity: 0.05, dashArray: '6 4' }}
              />
            )}
            <EnquadrarEstado contorno={contorno} />
            <Marker
              position={pos}
              draggable
              eventHandlers={marcadorArrastavel}
              alt={`Pino da propriedade em ${decimal(pos[0])}, ${decimal(pos[1])}`}
            />
            <CliqueNoMapa aoMover={setPos} />
          </MapContainer>
        </div>

        <footer className="pagina-confirmar__acoes">
          <button type="button" className="btn-voltar" onClick={() => navigate('/localizacao')}>
            <span aria-hidden="true" className='btn-voltar__seta'>&lt;&lt;</span> <span className="btn-voltar__texto">Voltar</span>
          </button>
          <button
            type="button"
            className="btn-confirmar"
            onClick={confirmar}
            disabled={foraDoEstado}
            title={foraDoEstado ? `Mova o pino para dentro de ${uf}` : 'Confirmar esta localização'}
          >
            Confirmar <img src={iconeCheck} alt="" aria-hidden="true" />
          </button>
        </footer>
      </main>
    </>
  );
}

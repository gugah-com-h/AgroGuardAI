import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import css from '../assets/css/confirmarMapa.css?inline';
import checkIcon from '../assets/img/icons/check-lg.svg';

// Fix Leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function dentroDosBrasil(lat, lng) {
  return lat >= -33.75 && lat <= 5.3 && lng >= -73.99 && lng <= -34.79;
}

function ClickHandler({ onMove }) {
  useMapEvents({ click: (e) => {
    if (dentroDosBrasil(e.latlng.lat, e.latlng.lng)) {
      onMove([e.latlng.lat, e.latlng.lng]);
    }
  }});
  return null;
}

export default function ConfirmarLocalizacao() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uf = params.get('uf') || '';
  const municipio = params.get('municipio') || '';
  const initLat = parseFloat(params.get('lat')) || -15.5;
  const initLon = parseFloat(params.get('lon')) || -49.5;

  const [pos, setPos] = useState([initLat, initLon]);
  const [contorno, setContorno] = useState(null);

  useEffect(() => {
    if (!uf) return;
    fetch(`/api/estado/${uf}`)
      .then(r => r.json())
      .then(data => { if (data.contorno) setContorno(data.contorno); })
      .catch(() => {});
  }, [uf]);

  const handleConfirm = () => {
    const p = new URLSearchParams({ uf, municipio, lat: pos[0], lon: pos[1] });
    navigate(`/mapa?${p}`);
  };

  return (
    <>
      <title>AgroGuard Ai - Localização</title>
      <style>{css}</style>

      <main className="mapa-container">
        <header className="mapa-header">
          <span className="badge-brand">AgroGuard Ai</span>
          <h1>Confirme sua Localização</h1>
          <p>Clique no mapa exatamente sobre a área da sua propriedade para definir a localização final.</p>
        </header>

        <div id="map" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
          <MapContainer
            center={pos}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            <Marker position={pos} />
            <ClickHandler onMove={setPos} />
            {contorno && (
              <GeoJSON
                data={contorno}
                style={{ color: '#488E43', weight: 2, fillOpacity: 0.05, dashArray: '6 4' }}
              />
            )}
          </MapContainer>
        </div>

        <footer className="mapa-actions">
          <button type="button" className="btn-confirmar" onClick={handleConfirm}>
            Confirmar <img src={checkIcon} alt="Ícone de confirmação" />
          </button>
        </footer>
      </main>
    </>
  );
}

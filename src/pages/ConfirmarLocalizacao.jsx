import { Link } from 'react-router-dom';
import css from '../assets/css/confirmarMapa.css?inline';
import checkIcon from '../assets/img/icons/check-lg.svg';

export default function ConfirmarLocalizacao() {
  return (
    <>
      <title>AgroGuard Ai - Localização</title>
      <style>{css}</style>

      <main className="mapa-container">
        {/* Card superior flutuante com o título e instrução */}
        <header className="mapa-header">
          <span className="badge-brand">AgroGuard Ai</span>
          <h1>Confirme sua Localização</h1>
          <p>Clique no mapa exatamente sobre a área da sua propriedade para definir a localização final.</p>
        </header>

        {/* Container onde o Mapa (ex: Leaflet, Google Maps, OpenStreetMap) será renderizado */}
        <div id="map">
          {/* Marcador ilustrativo do mapa */}
          <div className="custom-pin">
            <div className="pin-head"></div>
            <div className="pin-pulse"></div>
          </div>
        </div>

        {/* Barra inferior com o botão de confirmação */}
        <footer className="mapa-actions">
          <Link to="/mapa">
            <button type="submit" className="btn-confirmar">
              Confirmar <img src={checkIcon} alt="Ícone de confirmação" />
            </button>
          </Link>
        </footer>
      </main>
    </>
  );
}

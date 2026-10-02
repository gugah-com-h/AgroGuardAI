import TopBar from '../components/TopBar';
import css from '../assets/css/mapaPericulosidade.css?inline';
import checkCircleIcon from '../assets/img/icons/check-circle.svg';

export default function MapaPericulosidade() {
  return (
    <>
      <title>AgroGuard Ai - Mapa de Periculosidade</title>
      <style>{css}</style>

      <TopBar />

      <main className="periculosidade-container">
        {/* Área do Mapa/Satélite */}
        <div className="map-area"></div>

        {/* Indicador de Status do Nível de Perigo */}
        <div className="status-card">
          <h2>BAIXO NÍVEL DE PERIGO</h2>
          <img src={checkCircleIcon} alt="Status OK" className="status-icon" />
        </div>
      </main>
    </>
  );
}

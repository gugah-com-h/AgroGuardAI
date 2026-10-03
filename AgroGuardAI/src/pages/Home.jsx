import { Link } from 'react-router-dom';
import css from '../assets/css/paginaInicial.css?inline';

export default function Home() {
  return (
    <>
      <title>AgroGuard Ai — Risco ambiental e aptidão agrícola</title>
      <meta
        name="description"
        content="Consulte o risco de queimadas e a aptidão agrícola do seu município com dados públicos do INPE, MAPA, ANA e IBGE."
      />
      <style>{css}</style>

      <main className="pagina-inicio">
        <section className="pagina-inicio__chamada">
          <h1>Aplicação criada para ajudar pequenos agricultores</h1>
          <Link to="/localizacao" className="pagina-inicio__link">
            <button type="button" className="pagina-inicio__cta">
              Comece já!
            </button>
          </Link>
        </section>

        <section className="pagina-inicio__marca">
          <h1>AgroGuard Ai</h1>
        </section>
      </main>
    </>
  );
}

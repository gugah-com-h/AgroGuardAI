import { Link } from 'react-router-dom';
import css from '../assets/css/paginaInicial.css?inline';

export default function Home() {
  return (
    <>
      <title>AgroGuard Ai - Home</title>
      <style>{css}</style>

      <main>
        <div className="lado-esquerdo">
          <h1>Aplicação criada para ajudar pequenos agricultores</h1>
          <Link to="/localizacao">
            <button>Comece já!</button>
          </Link>
        </div>

        <div className="lado-direito">
          <h1>AgroGuard Ai</h1>
        </div>
      </main>
    </>
  );
}

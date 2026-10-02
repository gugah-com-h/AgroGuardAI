import { useState } from 'react';
import { Link } from 'react-router-dom';
import globeIcon from '../assets/img/icons/globe-americas.svg';
import chatIcon from '../assets/img/icons/chat-right-dots-fill.svg';

// Barra superior das páginas Mapa e Chat.
// Desktop: barra verde com os ícones + logo.
// Mobile: hamburger que abre os ícones; `mobileTitle` (opcional) aparece no lugar do logo.
export default function TopBar({ mobileTitle }) {
  const [open, setOpen] = useState(false);
  const fechar = () => setOpen(false);

  return (
    <header className="top-bar">
      <div className={`nav-icons${open ? ' open' : ''}`}>
        <Link to="/mapa" onClick={fechar}>
          <button type="button" className="icon-btn" title="Mapa Global">
            <img src={globeIcon} alt="Globo" />
          </button>
        </Link>

        <Link to="/chat" onClick={fechar}>
          <button type="button" className="icon-btn" title="Mensagens/Suporte">
            <img src={chatIcon} alt="Chat" />
          </button>
        </Link>
      </div>

      <div className="logo">
        <h1>AgroGuard Ai</h1>
      </div>

      {mobileTitle && <p className="mobile-title">{mobileTitle}</p>}

      <button
        type="button"
        className="menu-toggle"
        aria-label="Abrir menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
    </header>
  );
}

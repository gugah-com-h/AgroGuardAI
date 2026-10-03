import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';

import ErrorBoundary from './components/ErrorBoundary.jsx';
import NaoEncontrado from './components/NaoEncontrado.jsx';
import Home from './pages/Home.jsx';
import Localizacao from './pages/Localizacao.jsx';
import ConfirmarLocalizacao from './pages/ConfirmarLocalizacao.jsx';
import MapaPericulosidade from './pages/MapaPericulosidade.jsx';

// /chat era um atalho histórico para a tela de resultado, mas o `Navigate`
// direto descartava a query string: quem clicasse nele perdia o município e
// caía num mapa sem dados.
function RedirecionaChat() {
  const [params] = useSearchParams();
  const busca = params.toString();
  return <Navigate to={busca ? `/mapa?${busca}` : '/mapa'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/localizacao" element={<Localizacao />} />
          <Route path="/confirmar-localizacao" element={<ConfirmarLocalizacao />} />
          <Route path="/mapa" element={<MapaPericulosidade />} />
          <Route path="/chat" element={<RedirecionaChat />} />
          {/* Sem isto, qualquer URL desconhecida renderizava uma tela branca. */}
          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

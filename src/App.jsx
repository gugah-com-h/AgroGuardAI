import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Home from './pages/Home';
import Localizacao from './pages/Localizacao';
import ConfirmarLocalizacao from './pages/ConfirmarLocalizacao';
import MapaPericulosidade from './pages/MapaPericulosidade';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/localizacao" element={<Localizacao />} />
        <Route path="/confirmar-localizacao" element={<ConfirmarLocalizacao />} />
        <Route path="/mapa" element={<MapaPericulosidade />} />
        <Route path="/chat" element={<Navigate to="/mapa" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

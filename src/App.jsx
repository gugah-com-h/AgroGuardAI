import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import ChatBot from './pages/ChatBot';
import Localizacao from './pages/Localizacao';
import ConfirmarLocalizacao from './pages/ConfirmarLocalizacao';
import MapaPericulosidade from './pages/MapaPericulosidade';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<ChatBot />} />
        <Route path="/localizacao" element={<Localizacao />} />
        <Route path="/confirmar-localizacao" element={<ConfirmarLocalizacao />} />
        <Route path="/mapa" element={<MapaPericulosidade />} />
      </Routes>
    </BrowserRouter>
  );
}

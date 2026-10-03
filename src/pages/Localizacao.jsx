import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import css from '../assets/css/paginaLocalizacao.css?inline';

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

const UF_NOMES = {
  'ACRE': 'AC', 'ALAGOAS': 'AL', 'AMAZONAS': 'AM', 'AMAPÁ': 'AP',
  'BAHIA': 'BA', 'CEARÁ': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES',
  'GOIÁS': 'GO', 'MARANHÃO': 'MA', 'MINAS GERAIS': 'MG', 'MATO GROSSO DO SUL': 'MS',
  'MATO GROSSO': 'MT', 'PARÁ': 'PA', 'PARAÍBA': 'PB', 'PERNAMBUCO': 'PE',
  'PIAUÍ': 'PI', 'PARANÁ': 'PR', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
  'RONDÔNIA': 'RO', 'RORAIMA': 'RR', 'RIO GRANDE DO SUL': 'RS', 'SANTA CATARINA': 'SC',
  'SERGIPE': 'SE', 'SÃO PAULO': 'SP', 'TOCANTINS': 'TO',
};

export default function Localizacao() {
  const navigate = useNavigate();
  const [uf, setUf] = useState('');
  const [municipios, setMunicipios] = useState([]);
  const [municipio, setMunicipio] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const handleGeolocalizacao = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada pelo navegador.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (lat < -33.75 || lat > 5.3 || lon < -73.99 || lon > -34.79) {
          setGeoError('Localização fora do Brasil.');
          setGeoLoading(false);
          return;
        }
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=pt`)
          .then(r => r.json())
          .then(data => {
            const addr = data.address || {};
            const cidade = addr.city || addr.town || addr.municipality || addr.village || '';
            const estado = addr.state || '';
            const ufDetectada = UF_NOMES[estado.toUpperCase()] || '';
            if (ufDetectada && cidade) {
              const params = new URLSearchParams({
                uf: ufDetectada, municipio: cidade.toUpperCase(),
                lat: lat.toFixed(6), lon: lon.toFixed(6)
              });
              navigate(`/confirmar-localizacao?${params}`);
            } else {
              setGeoError('Não foi possível identificar o município. Selecione manualmente.');
              setGeoLoading(false);
            }
          })
          .catch(() => {
            setGeoError('Erro ao buscar endereço. Selecione manualmente.');
            setGeoLoading(false);
          });
      },
      (err) => {
        const msgs = {
          1: 'Permissão de localização negada.',
          2: 'Localização indisponível.',
          3: 'Tempo esgotado ao buscar localização.',
        };
        setGeoError(msgs[err.code] || 'Erro ao obter localização.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (!uf) { setMunicipios([]); setMunicipio(''); return; }
    setLoading(true);
    setMunicipio('');
    fetch(`/api/estado/${uf}`)
      .then(r => r.json())
      .then(data => {
        setMunicipios(data.municipios || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uf]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!uf || !municipio) return;
    const mun = municipios.find(m => m.nome === municipio);
    if (!mun) return;
    const params = new URLSearchParams({
      uf, municipio, lat: mun.lat, lon: mun.lon
    });
    navigate(`/confirmar-localizacao?${params}`);
  };

  return (
    <>
      <title>AgroGuard Ai - Localização</title>
      <style>{css}</style>

      <main>
        <form onSubmit={handleSubmit}>
          <div className="lado-esquerdo">
            <div className="form-container">
              <div className="row">
                <div className="input-group">
                  <label htmlFor="estado">Estado</label>
                  <select id="estado" name="estado" value={uf} onChange={e => setUf(e.target.value)}>
                    <option value="" disabled hidden>Estado</option>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="input-group full-width">
                  <label htmlFor="cidade">Município</label>
                  <select
                    id="cidade"
                    name="cidade"
                    value={municipio}
                    onChange={e => setMunicipio(e.target.value)}
                    disabled={!uf || loading}
                  >
                    <option value="" disabled hidden>
                      {loading ? 'Carregando...' : 'Município'}
                    </option>
                    {municipios.map(m => (
                      <option key={m.nome} value={m.nome}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row" style={{ justifyContent: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <div style={{ flex: 1, height: 1, background: '#ccc' }} />
                  <span style={{ fontSize: '0.8rem', color: '#888', fontStyle: 'italic' }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: '#ccc' }} />
                </div>
              </div>

              <div className="row">
                <button
                  type="button"
                  onClick={handleGeolocalizacao}
                  disabled={geoLoading}
                  className="btn-geo"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                  </svg>
                  {geoLoading ? 'Localizando...' : 'Usar minha localização'}
                </button>
              </div>
              {geoError && (
                <p style={{ color: '#c0392b', fontSize: '0.82rem', margin: 0, textAlign: 'center' }}>{geoError}</p>
              )}
            </div>
          </div>

          <div className="lado-direito">
            <h1>AgroGuard Ai</h1>
            <h2>Informe a localização de sua propriedade</h2>
            <button type="submit" disabled={!uf || !municipio}>Próximo &gt;&gt;</button>
          </div>
        </form>
      </main>
    </>
  );
}

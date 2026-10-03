import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, foiCancelado } from '../lib/api.js';
import { inteiro } from '../lib/format.js';
import css from '../assets/css/paginaLocalizacao.css?inline';

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

const UF_POR_NOME = {
  ACRE: 'AC', ALAGOAS: 'AL', AMAZONAS: 'AM', 'AMAPÁ': 'AP', BAHIA: 'BA',
  'CEARÁ': 'CE', 'DISTRITO FEDERAL': 'DF', 'ESPÍRITO SANTO': 'ES', 'GOIÁS': 'GO',
  'MARANHÃO': 'MA', 'MINAS GERAIS': 'MG', 'MATO GROSSO DO SUL': 'MS',
  'MATO GROSSO': 'MT', 'PARÁ': 'PA', 'PARAÍBA': 'PB', PERNAMBUCO: 'PE',
  'PIAUÍ': 'PI', 'PARANÁ': 'PR', 'RIO DE JANEIRO': 'RJ', 'RIO GRANDE DO NORTE': 'RN',
  'RONDÔNIA': 'RO', RORAIMA: 'RR', 'RIO GRANDE DO SUL': 'RS', 'SANTA CATARINA': 'SC',
  SERGIPE: 'SE', 'SÃO PAULO': 'SP', TOCANTINS: 'TO',
};

// Caixa envolvente do Brasil, usada para descartar leituras de GPS absurdas.
const BR = { latMin: -33.75, latMax: 5.3, lonMin: -73.99, lonMax: -34.79 };
const dentroDoBrasil = (lat, lon) =>
  lat >= BR.latMin && lat <= BR.latMax && lon >= BR.lonMin && lon <= BR.lonMax;

/** Compara nomes de município ignorando acento, caixa e pontuação. */
const chaveNome = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const IconeAlerta = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
  </svg>
);

export default function Localizacao() {
  const navigate = useNavigate();
  const [uf, setUf] = useState('');
  const [municipios, setMunicipios] = useState([]);
  const [municipio, setMunicipio] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erroLista, setErroLista] = useState('');
  const [geoCarregando, setGeoCarregando] = useState(false);
  const [geoErro, setGeoErro] = useState('');
  const [tentativa, setTentativa] = useState(0); // permite "tentar de novo"
  const geoAbort = useRef(null);

  // Carrega os municípios do estado.
  // Antes: sem checagem de `r.ok` (um 500 virava lista vazia silenciosa) e sem
  // cancelamento — trocar de estado rápido podia deixar a lista do estado
  // anterior na tela, por causa da ordem de chegada das respostas.
  useEffect(() => {
    if (!uf) {
      setMunicipios([]);
      setMunicipio('');
      setErroLista('');
      return;
    }

    const ctrl = new AbortController();
    setCarregando(true);
    setErroLista('');
    setMunicipio('');

    apiGet(`/estado/${uf}`, { signal: ctrl.signal })
      .then((dados) => {
        setMunicipios(Array.isArray(dados?.municipios) ? dados.municipios : []);
        setCarregando(false);
      })
      .catch((erro) => {
        if (foiCancelado(erro)) return; // troca de estado: resposta descartada
        setMunicipios([]);
        setErroLista(erro.message);
        setCarregando(false);
      });

    return () => ctrl.abort();
  }, [uf, tentativa]);

  useEffect(() => () => geoAbort.current?.abort(), []);

  const irParaConfirmacao = useCallback(
    (sigla, nome, lat, lon) => {
      navigate(
        `/confirmar-localizacao?${new URLSearchParams({
          uf: sigla,
          municipio: nome,
          lat: String(lat),
          lon: String(lon),
        })}`,
      );
    },
    [navigate],
  );

  const usarMinhaLocalizacao = () => {
    if (!navigator.geolocation) {
      setGeoErro('Seu navegador não oferece geolocalização. Selecione o município na lista.');
      return;
    }
    setGeoCarregando(true);
    setGeoErro('');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;

        if (!dentroDoBrasil(lat, lon)) {
          setGeoErro('Sua localização está fora do Brasil. O AgroGuard cobre apenas municípios brasileiros.');
          setGeoCarregando(false);
          return;
        }

        // O Nominatim não tinha tempo limite: a tela podia ficar em
        // "Localizando..." para sempre se o serviço não respondesse.
        const ctrl = new AbortController();
        geoAbort.current = ctrl;
        const limite = setTimeout(() => ctrl.abort(), 12000);

        try {
          const url =
            'https://nominatim.openstreetmap.org/reverse' +
            `?lat=${lat}&lon=${lon}&format=json&zoom=10&accept-language=pt-BR`;
          const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error('nominatim');

          const dados = await res.json();
          const end = dados.address || {};
          const cidade = end.city || end.town || end.municipality || end.village || end.county || '';
          const sigla = UF_POR_NOME[(end.state || '').toUpperCase()] || '';

          if (!sigla || !cidade) {
            setGeoErro('Não conseguimos identificar seu município. Selecione na lista acima.');
            setGeoCarregando(false);
            return;
          }

          // Antes o fluxo de GPS mandava o nome em CAIXA ALTA e o fluxo manual
          // em caixa normal, então a mesma cidade aparecia escrita de dois
          // jeitos nas telas seguintes. Aqui buscamos o nome oficial na API.
          let nomeOficial = cidade;
          try {
            const estado = await apiGet(`/estado/${sigla}`, { signal: ctrl.signal });
            const achado = (estado?.municipios || []).find(
              (m) => chaveNome(m.nome) === chaveNome(cidade),
            );
            if (achado) nomeOficial = achado.nome;
          } catch {
            /* sem o nome oficial seguimos com o do Nominatim */
          }

          irParaConfirmacao(sigla, nomeOficial, lat.toFixed(6), lon.toFixed(6));
        } catch (erro) {
          if (erro?.name !== 'AbortError') {
            setGeoErro('O serviço de endereços não respondeu. Selecione o município na lista.');
          } else {
            setGeoErro('A busca do endereço demorou demais. Selecione o município na lista.');
          }
          setGeoCarregando(false);
        } finally {
          clearTimeout(limite);
          geoAbort.current = null;
        }
      },
      (erro) => {
        const msgs = {
          1: 'Você negou o acesso à localização. Autorize no navegador ou selecione o município na lista.',
          2: 'Não foi possível determinar sua localização. Selecione o município na lista.',
          3: 'A busca pela sua localização demorou demais. Tente de novo ou selecione na lista.',
        };
        setGeoErro(msgs[erro.code] || 'Erro ao obter sua localização.');
        setGeoCarregando(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const enviar = (e) => {
    e.preventDefault();
    if (!uf || !municipio) return;
    const escolhido = municipios.find((m) => m.nome === municipio);
    if (!escolhido) return;
    irParaConfirmacao(uf, escolhido.nome, escolhido.lat, escolhido.lon);
  };

  const prontoParaAvancar = Boolean(uf && municipio);

  return (
    <>
      <title>AgroGuard Ai — Informe sua localização</title>
      <meta name="description" content="Selecione o estado e o município da sua propriedade para consultar o risco ambiental." />
      <style>{css}</style>

      {/* O <main> carrega o layout; o <form> é transparente (display:contents)
          para não criar um nível extra de caixa entre o root e as colunas. */}
      <main className="pagina-localizacao">
        <form className="pagina-localizacao__form-transparente" onSubmit={enviar}>
          <section className="pagina-localizacao__form">
            <div className="pagina-localizacao__campos">
              <div className="campo">
                <label htmlFor="estado">Estado</label>
                <select
                  id="estado"
                  name="estado"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  autoComplete="address-level1"
                >
                  <option value="" disabled hidden>
                    Selecione o estado
                  </option>
                  {UFS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              <div className="campo">
                <label htmlFor="cidade">Município</label>
                <select
                  id="cidade"
                  name="cidade"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  disabled={!uf || carregando || municipios.length === 0}
                  autoComplete="address-level2"
                  aria-describedby="dica-municipio"
                >
                  <option value="" disabled hidden>
                    {!uf ? 'Escolha o estado primeiro' : carregando ? 'Carregando municípios…' : 'Selecione o município'}
                  </option>
                  {municipios.map((m) => (
                    <option key={m.nome} value={m.nome}>{m.nome}</option>
                  ))}
                </select>
                <span className="campo__dica" id="dica-municipio" aria-live="polite">
                  {carregando
                    ? 'Buscando a lista de municípios…'
                    : municipios.length > 0
                      ? `${inteiro(municipios.length)} municípios — digite as primeiras letras para buscar`
                      : ' '}
                </span>
              </div>

              {erroLista && (
                <p className="aviso aviso--erro" role="alert">
                  <IconeAlerta />
                  <span>
                    {erroLista}{' '}
                    <button type="button" className="aviso__acao" onClick={() => setTentativa((t) => t + 1)}>
                      Tentar de novo
                    </button>
                  </span>
                </p>
              )}

              <div className="separador">
                <span>ou</span>
              </div>

              <button type="button" className="btn-geo" onClick={usarMinhaLocalizacao} disabled={geoCarregando}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
                {geoCarregando ? 'Localizando…' : 'Usar minha localização'}
              </button>

              {geoErro && (
                <p className="aviso aviso--erro" role="alert">
                  <IconeAlerta />
                  <span>{geoErro}</span>
                </p>
              )}
            </div>
          </section>

          <section className="pagina-localizacao__marca">
            <h1>AgroGuard Ai</h1>
            <h2>Informe a localização de sua propriedade</h2>
            <button type="submit" className="btn-proximo" disabled={!prontoParaAvancar}>
              Próximo &gt;&gt;
            </button>
          </section>
        </form>
      </main>
    </>
  );
}

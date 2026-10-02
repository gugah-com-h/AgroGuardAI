import { useNavigate } from 'react-router-dom';
import css from '../assets/css/paginaLocalizacao.css?inline';

export default function Localizacao() {
  const navigate = useNavigate();

  // Equivalente ao <form method="get"> original: envia os campos pela query string
  const handleSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(new FormData(e.currentTarget));
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
              <div className="input-group full-width">
                <label htmlFor="endereco">Endereço</label>
                <input type="text" id="endereco" name="endereco" placeholder="Rua / Avenida" />
              </div>

              <div className="row">
                <div className="input-group">
                  <label htmlFor="pais">Country</label>
                  <select id="pais" name="pais" defaultValue="">
                    <option value="" disabled hidden>Country</option>
                    <option value="BR">Brasil</option>
                    <option value="US">Estados Unidos</option>
                    <option value="ES">Espanha</option>
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="input-group">
                  <label htmlFor="cidade">Cidade</label>
                  <input type="text" id="cidade" name="cidade" placeholder="Cidade" />
                </div>

                <div className="input-group">
                  <label htmlFor="estado">Estado</label>
                  <input type="text" id="estado" name="estado" placeholder="Estado" />
                </div>
              </div>
            </div>
          </div>

          <div className="lado-direito">
            <h1>AgroGuard Ai</h1>
            <h2>Informe a localização de sua propriedade</h2>
            <button type="submit">Próximo &gt;&gt;</button>
          </div>
        </form>
      </main>
    </>
  );
}

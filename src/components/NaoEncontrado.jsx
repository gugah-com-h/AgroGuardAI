import { Link } from 'react-router-dom';

// Antes, qualquer URL fora das 4 rotas renderizava uma página em branco.
export default function NaoEncontrado() {
  return (
    <>
      <title>AgroGuard Ai — Página não encontrada</title>
      <div className="tela-erro">
        <div className="tela-erro__caixa">
          <h1>Página não encontrada</h1>
          <p>O endereço que você abriu não existe no AgroGuard.</p>
          <div className="tela-erro__acoes">
            <Link to="/">Voltar ao início</Link>
          </div>
        </div>
      </div>
    </>
  );
}

import { Component } from 'react';

// Rede de segurança: sem isto, qualquer exceção de renderização derruba a
// árvore inteira e o usuário fica com uma tela branca sem explicação.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('[AgroGuard] erro de renderização:', erro, info);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div className="tela-erro" role="alert">
        <div className="tela-erro__caixa">
          <h1>Algo quebrou nesta tela</h1>
          <p>
            Tivemos um erro inesperado ao montar a página. Você pode tentar de novo
            ou voltar ao início.
          </p>
          <pre className="tela-erro__detalhe">{String(this.state.erro?.message || this.state.erro)}</pre>
          <div className="tela-erro__acoes">
            <button type="button" onClick={() => window.location.reload()}>
              Recarregar
            </button>
            <a href="/">Voltar ao início</a>
          </div>
        </div>
      </div>
    );
  }
}

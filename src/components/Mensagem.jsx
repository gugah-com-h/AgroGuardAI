import { Fragment } from 'react';

// Renderizador de markdown mínimo para as respostas do Gemini.
//
// A versão anterior só tratava **negrito**. Tudo o mais que o modelo produz
// (listas com "* ", "- ", "1. " e títulos com "##") aparecia cru na tela,
// com os asteriscos à mostra.

function comNegrito(texto, chave) {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') && parte.length > 4 ? (
      <strong key={`${chave}-n${i}`}>{parte.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${chave}-t${i}`}>{parte}</Fragment>
    ),
  );
}

const ITEM_LISTA = /^\s*(?:[-*•]|\d+[.)])\s+/;

export default function Mensagem({ texto }) {
  const linhas = String(texto ?? '').split('\n');
  const blocos = [];
  let lista = null;

  const fecharLista = () => {
    if (lista) {
      blocos.push(
        <ul key={`l${blocos.length}`}>
          {lista.map((item, i) => (
            <li key={i}>{comNegrito(item, `l${blocos.length}i${i}`)}</li>
          ))}
        </ul>,
      );
      lista = null;
    }
  };

  linhas.forEach((linha, i) => {
    const limpa = linha.trim();

    if (!limpa) {
      fecharLista();
      return;
    }

    if (ITEM_LISTA.test(limpa)) {
      (lista ??= []).push(limpa.replace(ITEM_LISTA, ''));
      return;
    }

    fecharLista();

    // Títulos markdown viram texto forte, sem poluir a hierarquia da página.
    const titulo = limpa.match(/^#{1,6}\s+(.*)$/);
    blocos.push(
      <p key={`p${i}`}>
        {titulo ? <strong>{titulo[1]}</strong> : comNegrito(limpa, `p${i}`)}
      </p>,
    );
  });

  fecharLista();
  return <>{blocos}</>;
}

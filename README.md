# AgroGuard Ai — Frontend (React + Vite)

Interface do AgroGuard: mapa de focos de calor, scores de risco ambiental e
aptidão agrícola por município, e um assistente que explica os números.

## Rodar

```bash
npm install
cp .env.example .env    # preencha VITE_GEMINI_KEY
npm run dev
```

O backend (FastAPI) precisa estar no ar em `http://localhost:8000` — o Vite
encaminha `/api/*` para lá. Para apontar para outro endereço, defina
`VITE_API_BASE` no `.env`.

Rotas: `/` · `/localizacao` · `/confirmar-localizacao` · `/mapa`

## Segurança da chave

**A chave do Gemini usada neste projeto foi exposta publicamente e o Google a
bloqueou.** Gere uma nova em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
antes de usar o assistente.

Toda variável com prefixo `VITE_` é embutida no JavaScript entregue ao
navegador — qualquer visitante consegue extraí-la do bundle. Enquanto a
chamada ao Gemini sair do navegador, a chave é pública por construção.

Mitigação imediata: restrinja a chave por referenciador HTTP no Google Cloud
Console (APIs e Serviços → Credenciais → a chave → Restrições de aplicativo),
limitando-a ao domínio do AgroGuard.

Correção definitiva: mover a chamada para o backend, expondo um endpoint
`POST /chat` que guarda a chave no servidor. O frontend já está preparado —
basta trocar o corpo de `src/lib/gemini.js` por uma chamada ao backend.

## Estrutura

```
src/
├── lib/
│   ├── api.js            Cliente da API: checa res.ok, cancela, traduz erros
│   ├── gemini.js         Cliente do Gemini: cascata de modelos, erros claros
│   ├── prompt.js         Monta a instrução de sistema a partir de /score
│   ├── score.js          Faixas, rótulos e cores dos scores (fonte única)
│   ├── geo.js            Ponto-em-polígono e limites do contorno estadual
│   ├── format.js         Formatação pt-BR de números, moeda e percentuais
│   └── leafletIcone.js   Ícone do Leaflet servido pelo próprio build
├── components/
│   ├── ErrorBoundary.jsx Impede a tela branca em erro de renderização
│   ├── Mensagem.jsx      Markdown mínimo das respostas da IA
│   ├── NaoEncontrado.jsx Rota 404
│   └── TopBar.jsx        Barra superior (componente hoje sem uso)
├── pages/
│   ├── Home.jsx
│   ├── Localizacao.jsx
│   ├── ConfirmarLocalizacao.jsx
│   └── MapaPericulosidade.jsx
└── assets/css/           Uma folha por página, escopada em .pagina-*
```

### Convenções

- **CSS escopado por página.** Cada folha só estiliza dentro da sua raiz
  (`.pagina-inicio`, `.pagina-localizacao`, …). Reset, tokens e regras de
  `<body>` ficam apenas em `style.css`.
- **Cores por token.** Use as variáveis de `:root`. As cores de score em
  `style.css` espelham `src/lib/score.js` e todas passam em contraste
  WCAG AA (≥4,5:1) sobre branco.
- **Erros de rede são visíveis.** Nunca `fetch().then(r => r.json())` sem
  checar `r.ok` — use `apiGet`, que traduz o erro para português e distingue
  cancelamento de falha real.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `VITE_GEMINI_KEY` | para o chat | — | Chave do Google AI Studio |
| `VITE_GEMINI_MODELS` | não | `gemini-3.5-flash-lite,gemini-3.8-flash` | Cascata de modelos |
| `VITE_API_BASE` | não | `/api` | Base da API do AgroGuard |

## Scripts

```bash
npm run dev       # desenvolvimento
npm run build     # build de produção
npm run preview   # serve o build
npm run lint      # oxlint
```

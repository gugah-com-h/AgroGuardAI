import TopBar from '../components/TopBar';
import css from '../assets/css/chatBot.css?inline';

export default function ChatBot() {
  const handleSubmit = (e) => e.preventDefault();

  // Enter envia (Shift+Enter quebra linha), igual ao original
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form.requestSubmit();
    }
  };

  return (
    <>
      <title>AgroGuard Ai - ChatBot</title>
      <style>{css}</style>

      <TopBar mobileTitle="fale com seu assistente" />

      <main className="chat-wrapper">
        <div className="chat-card">
          <div className="chat-messages">
            <div className="message ai-message">
              <p>Olá! Sou a assistente do AgroGuard Ai. Como posso ajudar com a sua propriedade hoje?</p>
            </div>

            <div className="message user-message">
              <p>Gostaria de saber a previsão de risco de incêndio para a minha região esta semana.</p>
            </div>

            <div className="message ai-message">
              <p>Com base na localização cadastrada, o nível atual é **BAIXO**. As condições climáticas atuais estão favoráveis.</p>
            </div>
          </div>

          {/* Barra Inferior de Entrada (Textarea + Botão Enviar) */}
          <form className="chat-input-bar" onSubmit={handleSubmit}>
            <textarea
              placeholder="Digite uma mensagem..."
              rows="1"
              id="chat-textarea"
              onKeyDown={handleKeyDown}
            ></textarea>

            <button type="submit" className="send-btn" title="Enviar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

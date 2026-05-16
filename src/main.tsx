import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ============================================================
// INICIALIZAÇÃO SEGURA - Sem dependência do Capacitor
// ============================================================

// Função para verificar recursos mínimos necessários
function checkMinimumRequirements(): string | null {
  const issues: string[] = [];

  if (typeof Promise === 'undefined') issues.push('Promise');
  if (typeof fetch === 'undefined') issues.push('fetch');
  if (typeof localStorage === 'undefined') issues.push('localStorage');
  if (typeof requestAnimationFrame === 'undefined') issues.push('requestAnimationFrame');
  
  try {
    eval('const test = () => {};');
    eval('const { a, ...b } = { a: 1, c: 2 };');
    eval('class Test {}');
  } catch {
    issues.push('ES6+ (WebView desatualizado)');
  }

  if (issues.length > 0) {
    return `Recursos não suportados: ${issues.join(', ')}. Atualize o Android System WebView na Play Store.`;
  }

  return null;
}

// Tela de fallback para erros
function showFallbackScreen(title: string, message: string, showRetry: boolean = false) {
  document.body.innerHTML = `
    <div style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(to bottom, #124854, #1F3A5F);
      color: white;
      text-align: center;
      gap: 16px;
    ">
      <div style="font-size: 48px; margin-bottom: 8px;">⚠️</div>
      <h1 style="font-size: 22px; font-weight: 700; margin: 0;">${title}</h1>
      <p style="font-size: 14px; opacity: 0.85; max-width: 300px; line-height: 1.5; margin: 0;">
        ${message}
      </p>
      <div style="
        margin-top: 16px;
        padding: 12px 16px;
        background: rgba(255,255,255,0.1);
        border-radius: 12px;
        font-size: 12px;
        opacity: 0.7;
        max-width: 300px;
      ">
        <p style="margin: 0 0 8px 0;">💡 Sugestões:</p>
        <ul style="text-align: left; margin: 0; padding-left: 20px;">
          <li>Atualize o Android System WebView na Play Store</li>
          <li>Verifique se seu Android está atualizado</li>
          <li>Reinicie o aparelho e tente novamente</li>
        </ul>
      </div>
      ${showRetry ? `
        <button onclick="location.reload()" style="
          margin-top: 16px;
          padding: 14px 32px;
          background: white;
          color: #124854;
          border: none;
          border-radius: 30px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        ">
          Tentar novamente
        </button>
      ` : ''}
      <p style="font-size: 11px; opacity: 0.5; margin-top: 8px;">
        Katuu v1.0
      </p>
    </div>
  `;
}

// Registra erros globais para debug
window.addEventListener('error', (event) => {
  console.error('[Katuu] Erro global:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Katuu] Promise não tratada:', {
    reason: event.reason,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// BOOTSTRAP
// ============================================================

function bootstrap() {
  try {
    // 1. Verifica compatibilidade
    const incompatibilityReason = checkMinimumRequirements();
    if (incompatibilityReason) {
      showFallbackScreen('Dispositivo incompatível', incompatibilityReason, false);
      console.error('[Katuu] Incompatível:', incompatibilityReason);
      return;
    }

    // 2. Verifica elemento root
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      showFallbackScreen('Erro de inicialização', 'Não foi possível carregar o app.', true);
      return;
    }

    // 3. Service Worker (apenas navegador, não WebView)
    if ('serviceWorker' in navigator && !navigator.userAgent.includes('Android')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.error('[Katuu] SW:', err);
        });
      });
    }

    // 4. Leaflet CSS
    import("leaflet/dist/leaflet.css").catch((err) => {
      console.error("[Katuu] Leaflet CSS:", err);
    });

    // 5. Renderiza o app
    createRoot(rootElement).render(<App />);
    console.log('[Katuu] ✅ App montado com sucesso');

  } catch (fatalError: any) {
    console.error('[Katuu] Erro fatal:', fatalError);
    showFallbackScreen('Erro inesperado', 'O app encontrou um problema. Tente novamente.', true);
  }
}

bootstrap();
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Registra o Service Worker para Push Notifications e PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('[SW] Registration failed:', err);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

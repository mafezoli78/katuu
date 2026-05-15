import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "leaflet/dist/leaflet.css";

// Service Worker apenas em ambiente web/PWA — não no app nativo
import("@capacitor/core").then(({ Capacitor }) => {
  if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[SW] Registration failed:', err);
      });
    });
  }
});

createRoot(document.getElementById("root")!).render(<App />);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './tokens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker exists to make the app installable — which is what puts it
// in the Android share sheet. It deliberately does not intercept requests:
// caching API responses behind Cloudflare Access is a way to serve a stale
// login page, and offline reading is out of scope.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

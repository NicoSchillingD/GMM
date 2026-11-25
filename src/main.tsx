import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import './styles/base.css';
import { AppProvider } from './lib/app';
import { App } from './App';
import Splash, { marcarSplashVisto } from './components/Splash';

registerSW({ immediate: true });
// Al activarse una versión nueva la App se recarga sola: esa recarga no debe repetir la animación de entrada.
navigator.serviceWorker?.addEventListener('controllerchange', marcarSplashVisto);
createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><AppProvider><App /></AppProvider><Splash /></BrowserRouter></StrictMode>,
);

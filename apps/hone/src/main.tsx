import { installNativeBridge } from './lib/native-bridge';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/globals.css';

installNativeBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { createRoot } from 'react-dom/client';

// React namespace is auto-injected via tsconfig "jsx": "react-jsx", so we
// deliberately do NOT `import React` here (an unused import in strict
// mode breaks the build).
import App from '@app/App';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';
import { installNativeBridge } from '@platform/native-bridge';
import './styles/globals.css';

installNativeBridge();

const mount = document.getElementById('root');
if (!mount) throw new Error('hone: #root missing');

createRoot(mount).render(
  <ErrorBoundary section="Hone">
    <App />
  </ErrorBoundary>,
);

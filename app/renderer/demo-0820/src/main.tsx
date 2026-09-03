import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

window.addEventListener('error', (event) => {
  console.error('[0820] window.error', event.message, event.filename, event.lineno);
  void window.trunkApi?.logEvent?.({
    level: 'error',
    message: '0820 window.error',
    context: {
      message: event.message,
      source: event.filename,
      line: event.lineno,
    },
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
  console.error('[0820] unhandledrejection', reason);
  void window.trunkApi?.logEvent?.({
    level: 'error',
    message: '0820 unhandledrejection',
    context: { reason },
  });
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('root element missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

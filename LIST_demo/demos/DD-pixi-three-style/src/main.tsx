import { createRoot } from 'react-dom/client';
import { applyDemoDefaults } from './demoIdentity';
import { App } from './App';
import './styles.css';

applyDemoDefaults();
createRoot(document.getElementById('root')!).render(<App />);

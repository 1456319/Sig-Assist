import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StartupBoundary, StartupReady } from './components/StartupBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupBoundary>
      <App />
      <StartupReady />
    </StartupBoundary>
  </StrictMode>
);

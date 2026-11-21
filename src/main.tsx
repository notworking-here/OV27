import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ensureLocalStorageHeadroom } from './services/proposalService';
import './index.css';

ensureLocalStorageHeadroom();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


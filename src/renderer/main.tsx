import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { App } from './App';
import type { SimRailHubApi } from '@/types/ipc';

declare global {
  interface Window { simrailHub?: SimRailHubApi }
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);

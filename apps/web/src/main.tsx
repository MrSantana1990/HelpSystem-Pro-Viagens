import React from 'react';
import { createRoot } from 'react-dom/client';
import { IdentityApp } from './IdentityApp.js';
import './styles.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IdentityApp />
  </React.StrictMode>,
);

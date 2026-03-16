import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { UpdateProvider } from './components/layout/UpdatePrompt';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UpdateProvider>
      <App />
    </UpdateProvider>
  </React.StrictMode>,
);

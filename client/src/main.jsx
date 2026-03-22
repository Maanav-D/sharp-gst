import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { CompanyProvider } from './context/CompanyContext';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CompanyProvider>
        <App />
        <Toaster position="top-right" toastOptions={{
          duration: 3000,
          style: { fontFamily: 'IBM Plex Sans, sans-serif', fontSize: '14px' },
        }} />
      </CompanyProvider>
    </BrowserRouter>
  </StrictMode>,
);

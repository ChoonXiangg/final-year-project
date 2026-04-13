import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import DeployedContracts from './DeployedContracts';
import Verify from './Verify';
import { WalletProvider } from './WalletContext';
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/deployed" element={<DeployedContracts />} />
          <Route path="/verify" element={<Verify />} />
        </Routes>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>
);

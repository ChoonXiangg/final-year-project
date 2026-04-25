import React, { createContext, useContext, useState } from 'react';
import { BrowserProvider } from 'ethers';

interface WalletContextValue {
  walletAddress: string | null;
  connecting: boolean;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async (): Promise<string | null> => {
    if (!(window as any).ethereum) { alert('MetaMask is not installed'); return null; }
    setConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]);
      const accounts = await provider.send('eth_requestAccounts', []);
      setWalletAddress(accounts[0]);
      return accounts[0];
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      return null;
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => setWalletAddress(null);

  return (
    <WalletContext.Provider value={{ walletAddress, connecting, connectWallet, disconnectWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

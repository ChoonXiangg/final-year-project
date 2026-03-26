import React, { createContext, useContext, useState, useCallback } from 'react';
import { WalletConnectModal, useWalletConnectModal } from '@walletconnect/modal-react-native';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

const PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const providerMetadata = {
  name: 'Passport Protocol',
  description: 'ZK passport identity verification',
  url: 'https://passportprotocol.xyz',
  icons: ['https://passportprotocol.xyz/icon.png'],
  redirect: {
    native: 'passportprotocol://',
  },
};

interface WalletContextType {
  walletAddress: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  getSigner: () => Promise<JsonRpcSigner | null>;
  isConnecting: boolean;
}

const WalletContext = createContext<WalletContextType>({
  walletAddress: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  getSigner: async () => null,
  isConnecting: false,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { open, isConnected, provider, address } = useWalletConnectModal();
  const [isConnecting, setIsConnecting] = useState(false);

  const walletAddress = isConnected && address ? address.toLowerCase() : null;

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      await open();
    } catch (err) {
      console.error('WalletConnect failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [open]);

  const disconnectWallet = useCallback(() => {
    provider?.disconnect();
  }, [provider]);

  const getSigner = useCallback(async (): Promise<JsonRpcSigner | null> => {
    if (!provider) return null;
    const ethersProvider = new BrowserProvider(provider);
    return ethersProvider.getSigner();
  }, [provider]);

  return (
    <WalletContext.Provider value={{ walletAddress, connectWallet, disconnectWallet, getSigner, isConnecting }}>
      {children}
      <WalletConnectModal
        projectId={PROJECT_ID}
        providerMetadata={providerMetadata}
      />
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import PixelBlast from './components/PixelBlast';
import GlareHover from './components/GlareHover';
import StaggeredMenu from './components/StaggeredMenu';

const menuItems = [
  { label: 'Deploy', ariaLabel: 'Deploy a verifier contract', link: '/' },
  { label: 'View', ariaLabel: 'View deployed contracts', link: '/deployed' },
  { label: 'Verify', ariaLabel: 'Verify a ZK proof', link: '/verify' },
  { label: 'TEE', ariaLabel: 'TEE attestation', link: '/attestation' },
];

const socialItems = [
  { label: 'GitHub', link: 'https://github.com' },
  { label: 'Docs', link: '#' },
];

export const FACTORY_ADDRESS = '0x7F58017ADd6CBA1cC1378A9215a3390552ab49Ce';

export const MONO: React.CSSProperties = { fontFamily: "'Major Mono Display', monospace", fontWeight: 'bold' };

export async function ensureSepoliaNetwork(): Promise<void> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) throw new Error('MetaMask is not installed');
  const chainId = await ethereum.request({ method: 'eth_chainId' });
  if (chainId === '0xaa36a7') return;
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
  } catch (switchErr: any) {
    if (switchErr.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0xaa36a7',
          chainName: 'Sepolia',
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://rpc.sepolia.org'],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        }],
      });
    } else {
      throw new Error('Please switch to the Sepolia test network');
    }
  }
}

interface LayoutProps {
  subtitle: string;
  children: React.ReactNode;
  onDisconnect?: () => void;
}

export default function Layout({ subtitle, children, onDisconnect }: LayoutProps) {
  const navigate = useNavigate();
  const { walletAddress, connecting, connectWallet, disconnectWallet: ctxDisconnect } = useWallet();
  const [copied, setCopied] = useState(false);

  const disconnectWallet = () => {
    ctxDisconnect();
    onDisconnect?.();
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative', overflow: 'hidden' }}>
        <StaggeredMenu
          position="left"
          items={menuItems}
          socialItems={socialItems}
          displaySocials
          displayItemNumbering
          menuButtonColor="#ffffff"
          openMenuButtonColor="#fff"
          changeMenuColorOnOpen
          colors={['red', 'cyan']}
          accentColor="#00ffff"
          isFixed={false}
        />
        <PixelBlast
          variant="square"
          pixelSize={4}
          color="#00ffff"
          patternScale={2}
          patternDensity={1}
          pixelSizeJitter={0}
          enableRipples
          rippleSpeed={0.4}
          rippleThickness={0.12}
          rippleIntensityScale={1.5}
          liquid={false}
          liquidStrength={0.12}
          liquidRadius={1.2}
          liquidWobbleSpeed={5}
          speed={0.5}
          edgeFade={0.25}
          transparent
        />
        <div
          onClick={() => navigate('/')}
          style={{
            position: 'absolute',
            top: '2rem',
            left: '8rem',
            zIndex: 1,
            background: '#000',
            padding: '0.25rem 0',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: "'Major Mono Display', monospace", fontSize: '5rem', color: '#fff' }}>
            ZK Identity Prover
          </span>
        </div>
        <p
          style={{
            position: 'absolute',
            top: '7.5rem',
            left: '8rem',
            color: '#fff',
            ...MONO,
            fontSize: '1rem',
            margin: 0,
            zIndex: 1,
            background: '#000',
            padding: '0.25rem 0',
          }}
        >
          {subtitle}
        </p>

        {children}

        <GlareHover
          background="#000"
          borderColor="#fff"
          borderRadius="0"
          width="auto"
          height="auto"
          glareColor="#ffffff"
          glareOpacity={1}
          glareAngle={-30}
          glareSize={200}
          transitionDuration={800}
          style={{ position: 'absolute', top: '2rem', right: '2rem', zIndex: 1, display: 'inline-grid' }}
        >
          <button
            onClick={walletAddress ? disconnectWallet : connectWallet}
            disabled={connecting}
            style={{
              padding: '1rem',
              background: 'transparent',
              border: 'none',
              color: '#fff',
              ...MONO,
              fontSize: '1rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : (connecting ? 'Connecting...' : 'Connect Wallet')}
            {walletAddress && (
              <span
                onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(walletAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                title={copied ? 'Copied!' : 'Copy address'}
                style={{ color: copied ? '#4ade80' : '#fff', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </span>
            )}
          </button>
        </GlareHover>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from './WalletContext';
import PixelBlast from './components/PixelBlast';
import GlareHover from './components/GlareHover';
import GlitchText from './components/GlitchText';
import StaggeredMenu from './components/StaggeredMenu';

const menuItems = [
  { label: 'Deploy', ariaLabel: 'Deploy a verifier contract', link: '/' },
  { label: 'View', ariaLabel: 'View deployed contracts', link: '/deployed' },
  { label: 'Verify', ariaLabel: 'Verify a ZK proof', link: '/verify' },
];

const socialItems = [
  { label: 'GitHub', link: 'https://github.com' },
  { label: 'Docs', link: '#' },
];

export const MONO: React.CSSProperties = { fontFamily: "'Major Mono Display', monospace", fontWeight: 'bold' };

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
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Major+Mono+Display&display=swap');`}</style>
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
          <GlitchText
            speed={1}
            enableShadows
            enableOnHover={false}
            style={{ fontFamily: "'Major Mono Display', monospace", fontSize: '5rem' }}
          >
            ZK Identity Prover
          </GlitchText>
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
          glareSize={500}
          transitionDuration={2000}
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
    </>
  );
}

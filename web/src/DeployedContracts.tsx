import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserProvider, Contract } from 'ethers';
import PixelBlast from './components/PixelBlast';
import GlareHover from './components/GlareHover';
import GlitchText from './components/GlitchText';
import AnimatedList from './components/AnimatedList';
import { getCountryName } from './data/countries';
import StaggeredMenu from './components/StaggeredMenu';

const menuItems = [
  { label: 'Deploy', ariaLabel: 'Deploy a verifier contract', link: '/' },
  { label: 'View', ariaLabel: 'View deployed contracts', link: '/deployed' },
];

const socialItems = [
  { label: 'GitHub', link: 'https://github.com' },
  { label: 'Docs', link: '#' },
];

const FACTORY_ADDRESS = '0x2b3Cedc63952530db65FDCfd48915D33BaDE488a';
const FACTORY_ABI = [
  'function getVerifiers(address owner) external view returns (address[])'
];
const APP_VERIFIER_ABI = [
  'function requireAge() view returns (bool)',
  'function minAge() view returns (uint256)',
  'function requireNationality() view returns (bool)',
  'function targetNationality() view returns (string)',
  'function requireSex() view returns (bool)',
  'function targetSex() view returns (string)',
  'function deployedAt() view returns (uint256)',
];

const MONO: React.CSSProperties = { fontFamily: "'Major Mono Display', monospace", fontWeight: 'bold' };

interface ContractData {
  address: string;
  requireAge: boolean;
  minAge: number;
  requireNationality: boolean;
  targetNationality: string;
  requireSex: boolean;
  targetSex: string;
  timestamp: number;
}

function formatRequirements(c: ContractData): string {
  const parts: string[] = [];
  if (c.requireAge) parts.push(`${c.minAge} years old`);
  if (c.requireNationality) parts.push(getCountryName(c.targetNationality));
  if (c.requireSex) parts.push(c.targetSex === 'M' ? 'Male' : 'Female');
  return parts.length > 0 ? parts.join(', ') : 'None';
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

function DeployedContracts() {
  const navigate = useNavigate();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchContracts = async (address: string) => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    setLoading(true);
    setFetchError(null);
    try {
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') {
        try {
          await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            await ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0xaa36a7',
                chainName: 'Sepolia',
                rpcUrls: ['https://rpc.sepolia.org'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              }],
            });
          } else {
            throw new Error('Please switch to the Sepolia test network');
          }
        }
      }
      const provider = new BrowserProvider(ethereum);
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const verifierAddresses: string[] = await factory.getVerifiers(address);
      const data: ContractData[] = await Promise.all(
        verifierAddresses.map(async (addr) => {
          const verifier = new Contract(addr, APP_VERIFIER_ABI, provider);
          const [requireAge, minAge, requireNationality, targetNationality, requireSex, targetSex, deployedAt] =
            await Promise.all([
              verifier.requireAge(),
              verifier.minAge(),
              verifier.requireNationality(),
              verifier.targetNationality(),
              verifier.requireSex(),
              verifier.targetSex(),
              verifier.deployedAt(),
            ]);
          return {
            address: addr,
            requireAge,
            minAge: Number(minAge),
            requireNationality,
            targetNationality,
            requireSex,
            targetSex,
            timestamp: Number(deployedAt),
          };
        })
      );
      setContracts(data.reverse());
    } catch (err: any) {
      console.error('Failed to fetch contracts:', err);
      setFetchError(err?.message ?? 'Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    if (!(window as any).ethereum) {
      alert('MetaMask is not installed');
      return;
    }
    setConnecting(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      setWalletAddress(accounts[0]);
      await fetchContracts(accounts[0]);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setContracts([]);
    setFetchError(null);
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
          Select your app requirements and deploy your verifier contract
        </p>
        <div
          style={{
            position: 'absolute',
            top: '12rem',
            left: '2rem',
            right: '2rem',
            bottom: 0,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <h2 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>
            <span style={{ background: '#000', padding: '0.25rem 0' }}>Deployed Contracts</span>
          </h2>
          {!walletAddress ? (
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Connect your wallet to view your deployed contracts</span>
            </p>
          ) : loading ? (
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Loading...</span>
            </p>
          ) : fetchError ? (
            <p style={{ color: '#f66', ...MONO, fontSize: '1rem', margin: 0 }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Error: {fetchError}</span>
            </p>
          ) : contracts.length === 0 ? (
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>No deployed contracts found</span>
            </p>
          ) : (
            <AnimatedList
              items={contracts.map(c => c.address)}
              showGradients
              enableArrowNavigation
              displayScrollbar
              renderItem={(_, index) => {
                const c = contracts[index];
                return (
                  <div style={{ ...MONO, fontSize: '1rem', color: '#fff' }}>
                    <p style={{ margin: '0 0 0.25rem 0' }}>Contract address: {c.address}</p>
                    <p style={{ margin: '0 0 0.25rem 0' }}>Requirements: {formatRequirements(c)}</p>
                    <p style={{ margin: 0 }}>Timestamp: {formatTimestamp(c.timestamp)}</p>
                  </div>
                );
              }}
            />
          )}
        </div>

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

export default DeployedContracts;

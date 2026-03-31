import { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import PixelBlast from './components/PixelBlast';
import GlareHover from './components/GlareHover';
import GlitchText from './components/GlitchText';
import AnimatedList from './components/AnimatedList';
import { getCountryName } from './data/countries';

const FACTORY_ADDRESS = '0x12c9169DD8067e2D30a9d660b2bab3848279413a';
const FACTORY_ABI = [
  'event VerifierCreated(address indexed verifier, address indexed owner, bool requireAge, uint256 minAge, bool requireNationality, string targetNationality, bool requireSex, string targetSex)'
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
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContracts = async (address: string) => {
    if (!(window as any).ethereum) return;
    setLoading(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const filter = factory.filters.VerifierCreated(null, address);
      const events = await factory.queryFilter(filter);
      const data: ContractData[] = await Promise.all(
        events.map(async (e: any) => {
          const parsed = factory.interface.parseLog(e);
          const block = await provider.getBlock(e.blockNumber);
          return {
            address: parsed?.args.verifier,
            requireAge: parsed?.args.requireAge,
            minAge: Number(parsed?.args.minAge),
            requireNationality: parsed?.args.requireNationality,
            targetNationality: parsed?.args.targetNationality,
            requireSex: parsed?.args.requireSex,
            targetSex: parsed?.args.targetSex,
            timestamp: block?.timestamp ?? 0,
          };
        })
      );
      setContracts(data.filter(c => c.address));
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
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
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Major+Mono+Display&display=swap');`}</style>
      <div style={{ width: '100vw', height: '100vh', background: '#000', position: 'relative' }}>
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
          style={{
            position: 'absolute',
            top: '2rem',
            left: '2rem',
            zIndex: 1,
            background: '#000',
            padding: '0.25rem 0',
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
            top: '9rem',
            left: '2rem',
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
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Connect your wallet to view deployed contracts</span>
            </p>
          ) : loading ? (
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Loading...</span>
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
            }}
          >
            {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : (connecting ? 'Connecting...' : 'Connect Wallet')}
          </button>
        </GlareHover>
      </div>
    </>
  );
}

export default DeployedContracts;

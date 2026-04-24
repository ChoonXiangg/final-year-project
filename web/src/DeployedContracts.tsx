import { useState, useCallback } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import AnimatedList from './components/AnimatedList';
import GlareHover from './components/GlareHover';
import { getCountryName } from './data/countries';
import Layout, { MONO, FACTORY_ADDRESS } from './Layout';

const SEPOLIA_RPC = process.env.REACT_APP_ALCHEMY_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

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

function QRModal({ address, onClose }: { address: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#000', border: '1px solid #fff', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative' }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '1.25rem' }}
          aria-label="Close"
        >
          ✕
        </button>
        <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>
          scan with the mobile app
        </p>
        <QRCodeSVG value={address} size={500} bgColor="#000000" fgColor="#ffffff" />
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <span
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy address'}
      style={{ color: copied ? '#4ade80' : '#fff', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginLeft: '0.4rem' }}
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </span>
  );
}

function DeployedContracts() {
  const [walletInput, setWalletInput] = useState('');
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [qrAddress, setQrAddress] = useState<string | null>(null);

  const handleView = async () => {
    if (!walletInput) return;
    setLoading(true);
    setFetchError(null);
    setContracts([]);
    setFetched(false);
    try {
      const provider = (window as any).ethereum
        ? new BrowserProvider((window as any).ethereum)
        : new JsonRpcProvider(SEPOLIA_RPC);
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const verifierAddresses: string[] = await factory.getVerifiers(walletInput);
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
      setFetched(true);
    } catch (err: any) {
      console.error('Failed to fetch contracts:', err);
      setFetchError(err?.message ?? 'Failed to fetch contracts');
    } finally {
      setLoading(false);
    }
  };

  const INPUT_STYLE: React.CSSProperties = {
    width: '100%',
    background: '#000',
    border: '1px solid #fff',
    color: '#fff',
    ...MONO,
    fontSize: '1rem',
    padding: '0.75rem',
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <Layout subtitle="View verifier contracts deployed by a wallet address">
      {qrAddress && <QRModal address={qrAddress} onClose={() => setQrAddress(null)} />}
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
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Wallet Address</span>
        </h2>
        <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: '0 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Enter a user's wallet address</span>
        </p>
        <input
          type="text"
          placeholder="0x..."
          value={walletInput}
          onChange={e => setWalletInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleView()}
          style={INPUT_STYLE}
        />
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
          style={{ display: 'inline-grid', marginTop: '1rem', marginBottom: '2rem', alignSelf: 'flex-start' }}
        >
          <button
            onClick={handleView}
            disabled={loading || !walletInput}
            style={{ padding: '1rem', background: 'transparent', border: 'none', color: '#fff', ...MONO, fontSize: '1rem', cursor: 'pointer' }}
          >
            {loading ? 'Loading...' : 'View Deployed Contracts'}
          </button>
        </GlareHover>

        {fetchError && (
          <p style={{ color: '#f66', ...MONO, fontSize: '0.9rem', margin: '0 0 1rem 0' }}>Error: {fetchError}</p>
        )}

        {fetched && (
          <>
            <h2 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Deployed Contracts</span>
            </h2>
            {contracts.length === 0 ? (
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
                      <p style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center' }}>
                        Contract address: {c.address}
                        <CopyButton text={c.address} />
                        <span
                          onClick={e => { e.stopPropagation(); setQrAddress(c.address); }}
                          title="Show QR code"
                          style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginLeft: '0.4rem', color: '#fff' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                            <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
                          </svg>
                        </span>
                      </p>
                      <p style={{ margin: '0 0 0.25rem 0' }}>Requirements: {formatRequirements(c)}</p>
                      <p style={{ margin: 0 }}>Timestamp: {formatTimestamp(c.timestamp)}</p>
                    </div>
                  );
                }}
              />
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

export default DeployedContracts;

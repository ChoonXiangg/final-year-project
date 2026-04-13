import { useState, useEffect } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { useWallet } from './WalletContext';
import AnimatedList from './components/AnimatedList';
import { getCountryName } from './data/countries';
import Layout, { MONO } from './Layout';

const FACTORY_ADDRESS = '0x7F58017ADd6CBA1cC1378A9215a3390552ab49Ce';
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

function DeployedContracts() {
  const { walletAddress } = useWallet();
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

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

  useEffect(() => {
    if (walletAddress) fetchContracts(walletAddress);
  }, [walletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout
      subtitle="Select your app requirements and deploy your verifier contract"
      onDisconnect={() => { setContracts([]); setFetchError(null); }}
    >
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
    </Layout>
  );
}

export default DeployedContracts;

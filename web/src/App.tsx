import { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import PixelBlast from './components/PixelBlast';
import GlareHover from './components/GlareHover';
import GlitchText from './components/GlitchText';
import { COUNTRIES } from './data/countries';

const FACTORY_ADDRESS = '0x12c9169DD8067e2D30a9d660b2bab3848279413a';
const SP1_VERIFIER_ADDRESS = '0x397A5f7f3dBd538f23DE225B51f532c34448dA9B';
const PASSPORT_VKEY = '0x00e73dac84f6c42374ebe6d54e839ed1fb039bbfb193e8daa5542359657a818c';

const FACTORY_ABI = [
  'function createVerifier(address _sp1Verifier, bytes32 _passportVKey, bool _requireAge, uint256 _minAge, bool _requireNationality, string _targetNationality, bool _requireSex, string _targetSex) external returns (address)',
  'event VerifierCreated(address indexed verifier, address indexed owner, bool requireAge, uint256 minAge, bool requireNationality, string targetNationality, bool requireSex, string targetSex)'
];

function App() {
  const [ageOn, setAgeOn] = useState(false);
  const [nationalityOn, setNationalityOn] = useState(false);
  const [genderOn, setGenderOn] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [targetNationality, setTargetNationality] = useState('AFG');
  const [targetSex, setTargetSex] = useState('M');

  const inputStyle: React.CSSProperties = {
    marginTop: '1rem',
    width: '100%',
    padding: '0.5rem',
    background: '#000',
    border: '1px solid #fff',
    color: '#fff',
    fontFamily: "'Major Mono Display', monospace",
    fontSize: '1rem',
    fontWeight: 'bold',
    boxSizing: 'border-box',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M7 10l5 5 5-5z'/></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.5rem center',
    backgroundSize: '1.5rem',
    paddingRight: '3rem',
  };
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ownedContracts, setOwnedContracts] = useState<string[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [showContracts, setShowContracts] = useState(false);

  const fetchOwnedContracts = async (address: string) => {
    if (!(window as any).ethereum) return;
    setLoadingContracts(true);
    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const filter = factory.filters.VerifierCreated(null, address);
      const events = await factory.queryFilter(filter);
      const addresses = events
        .map((e: any) => { try { return factory.interface.parseLog(e)?.args.verifier; } catch { return null; } })
        .filter(Boolean);
      setOwnedContracts(addresses);
    } catch (err) {
      console.error('Failed to fetch contracts:', err);
    } finally {
      setLoadingContracts(false);
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
      await fetchOwnedContracts(accounts[0]);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setDeployedAddress(null);
    setError(null);
    setOwnedContracts([]);
    setShowContracts(false);
  };

  const deployVerifier = async () => {
    if (!(window as any).ethereum) return;
    setDeploying(true);
    setError(null);
    setDeployedAddress(null);
    try {
      const ethereum = (window as any).ethereum;
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      if (chainId !== '0xaa36a7') {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }],
          });
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
            throw switchErr;
          }
        }
      }
      const provider = new BrowserProvider(ethereum);
      const signer = await provider.getSigner();
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
      const tx = await factory.createVerifier(
        SP1_VERIFIER_ADDRESS,
        PASSPORT_VKEY,
        ageOn,
        ageOn ? minAge : 0,
        nationalityOn,
        nationalityOn ? targetNationality : '',
        genderOn,
        genderOn ? targetSex : ''
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log: any) => { try { return factory.interface.parseLog(log); } catch { return null; } })
        .find((ev: any) => ev && ev.name === 'VerifierCreated');
      if (event) {
        setDeployedAddress(event.args.verifier);
        setOwnedContracts(prev => [...prev, event.args.verifier]);
      }
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      console.error('Deploy failed:', err);
    } finally {
      setDeploying(false);
    }
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
            fontFamily: "'Major Mono Display', monospace",
            fontSize: '1rem',
            fontWeight: 'bold',
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
          }}
        >
          <h2
            style={{
              color: '#fff',
              fontFamily: "'Major Mono Display', monospace",
              fontSize: '2rem',
              margin: '0 0 1rem 0',
            }}
          >
            <span style={{ background: '#000', padding: '0.25rem 0' }}>App Requirements</span>
          </h2>
          <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', margin: '0 0 1rem 0', fontWeight: 'bold' }}>
            <span style={{ background: '#000', padding: '0.25rem 0' }}>Select one or more requirements</span>
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div onClick={() => setAgeOn(!ageOn)} style={{ flex: 1, background: '#000', border: `1px solid ${ageOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '2rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Age</h3>
              <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Enter minimum age</p>
              {ageOn && (
                <input
                  type="number"
                  min={1} max={150}
                  value={minAge}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setMinAge(Number(e.target.value))}
                  style={inputStyle}
                />
              )}
            </div>
            <div onClick={() => setNationalityOn(!nationalityOn)} style={{ flex: 1, background: '#000', border: `1px solid ${nationalityOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '2rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Nationality</h3>
              <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Select required nationality</p>
              {nationalityOn && (
                <select
                  value={targetNationality}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setTargetNationality(e.target.value)}
                  style={selectStyle}
                >
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div onClick={() => setGenderOn(!genderOn)} style={{ flex: 1, background: '#000', border: `1px solid ${genderOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
              <h3 style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '2rem', fontWeight: 'bold', margin: '0 0 1rem 0' }}>Gender</h3>
              <p style={{ color: '#fff', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>Select required gender</p>
              {genderOn && (
                <select
                  value={targetSex}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setTargetSex(e.target.value)}
                  style={selectStyle}
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1.5rem' }}>
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
              transitionDuration={2000}
              style={{ display: 'inline-grid', opacity: deploying || !walletAddress || (!ageOn && !nationalityOn && !genderOn) ? 0.5 : 1 }}
            >
              <button
                onClick={deployVerifier}
                disabled={deploying || !walletAddress || (!ageOn && !nationalityOn && !genderOn)}
                style={{
                  padding: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontFamily: "'Major Mono Display', monospace",
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: deploying || !walletAddress || (!ageOn && !nationalityOn && !genderOn) ? 'not-allowed' : 'pointer',
                }}
              >
                {deploying ? 'Deploying...' : 'Deploy Contract'}
              </button>
            </GlareHover>
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
              transitionDuration={2000}
              style={{ display: 'inline-grid', opacity: !walletAddress || ownedContracts.length === 0 ? 0.5 : 1 }}
            >
              <button
                onClick={() => setShowContracts(prev => !prev)}
                disabled={!walletAddress || ownedContracts.length === 0}
                style={{
                  padding: '1rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontFamily: "'Major Mono Display', monospace",
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: !walletAddress || ownedContracts.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {loadingContracts ? 'Loading...' : 'View Deployed Contracts'}
              </button>
            </GlareHover>
          </div>
          {showContracts && ownedContracts.length > 0 && (
            <div style={{ marginTop: '1rem', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', color: '#fff' }}>
              {ownedContracts.map((addr, i) => (
                <p key={addr} style={{ margin: '0.25rem 0', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#000', padding: '0.25rem 0', width: '100%' }}>
                  {i + 1}. {addr}
                </p>
              ))}
            </div>
          )}
          {error && (
            <p style={{ color: '#f87171', fontFamily: "'Major Mono Display', monospace", fontSize: '0.85rem', marginTop: '1rem' }}>
              {error}
            </p>
          )}
          {deployedAddress && (
            <div style={{ marginTop: '1rem', fontFamily: "'Major Mono Display', monospace", fontSize: '1rem', color: '#fff' }}>
              <p style={{ margin: '0 0 0.25rem 0' }}><span style={{ background: '#000', padding: '0.25rem 0' }}>Deploy success!</span></p>
              <p style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#000', padding: '0.25rem 0' }}>
                Contract address: {deployedAddress}
                <button
                  onClick={() => { navigator.clipboard.writeText(deployedAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  title={copied ? 'Copied!' : 'Copy address'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: copied ? '#4ade80' : '#fff', display: 'flex', alignItems: 'center' }}
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
                </button>
              </p>
            </div>
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
              fontFamily: "'Major Mono Display', monospace",
              fontSize: '1rem',
              fontWeight: 'bold',
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

export default App;

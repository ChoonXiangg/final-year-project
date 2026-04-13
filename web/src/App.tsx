import { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { useWallet } from './WalletContext';
import GlareHover from './components/GlareHover';
import { COUNTRIES } from './data/countries';
import Layout, { MONO, ensureSepoliaNetwork, FACTORY_ADDRESS } from './Layout';

const SP1_VERIFIER_ADDRESS = '0x397A5f7f3dBd538f23DE225B51f532c34448dA9B';
const PASSPORT_VKEY = '0x00930f8b802c260e02f8e400fa7470cfaa4e1a04d51a7840e2f18ebe8d564cdc';

const FACTORY_ABI = [
  'function createVerifier(address _sp1Verifier, bytes32 _passportVKey, bool _requireAge, uint256 _minAge, bool _requireNationality, string _targetNationality, bool _requireSex, string _targetSex) external returns (address)',
  'function getVerifiers(address owner) external view returns (address[])',
  'event VerifierCreated(address indexed verifier, address indexed owner, bool requireAge, uint256 minAge, bool requireNationality, string targetNationality, bool requireSex, string targetSex)',
];

function App() {
  const { walletAddress } = useWallet();
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
    ...MONO,
    fontSize: '1rem',
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
  const [copied, setCopied] = useState(false);

  const deployVerifier = async () => {
    if (!(window as any).ethereum) return;
    setDeploying(true);
    setError(null);
    setDeployedAddress(null);
    try {
      await ensureSepoliaNetwork();
      const provider = new BrowserProvider((window as any).ethereum);
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
      }
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      console.error('Deploy failed:', err);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Layout
      subtitle="Select your app requirements and deploy your verifier contract"
      onDisconnect={() => { setDeployedAddress(null); setError(null); }}
    >
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
        <h2 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>App Requirements</span>
        </h2>
        <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: '0 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Select one or more requirements</span>
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div onClick={() => setAgeOn(!ageOn)} style={{ flex: 1, background: '#000', border: `1px solid ${ageOn ? '#4ade80' : '#fff'}`, borderRadius: 0, padding: '1.5rem', cursor: 'pointer' }}>
            <h3 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>Age</h3>
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>Enter minimum age</p>
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
            <h3 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>Nationality</h3>
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>Select required nationality</p>
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
            <h3 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>Gender</h3>
            <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: 0 }}>Select required gender</p>
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
            transitionDuration={800}
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
                ...MONO,
                fontSize: '1rem',
                cursor: deploying || !walletAddress || (!ageOn && !nationalityOn && !genderOn) ? 'not-allowed' : 'pointer',
              }}
            >
              {deploying ? 'Deploying...' : 'Deploy Contract'}
            </button>
          </GlareHover>
        </div>
        {error && (
          <p style={{ color: '#f87171', ...MONO, fontSize: '0.85rem', marginTop: '1rem' }}>
            {error}
          </p>
        )}
        {deployedAddress && (
          <div style={{ marginTop: '1rem', ...MONO, fontSize: '1rem', color: '#fff' }}>
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
    </Layout>
  );
}

export default App;

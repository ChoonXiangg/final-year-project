import React, { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import './App.css';

// TODO: Update these after deploying to Sepolia
const FACTORY_ADDRESS = '0x0000000000000000000000000000000000000000';
const SP1_VERIFIER_ADDRESS = '0x397A5f7f3dBd538f23DE225B51f532c34448dA9B';
const PASSPORT_VKEY = '0x00e73dac84f6c42374ebe6d54e839ed1fb039bbfb193e8daa5542359657a818c';

const FACTORY_ABI = [
  'function createVerifier(address _sp1Verifier, bytes32 _passportVKey, bool _requireAge, uint256 _minAge, bool _requireNationality, string _targetNationality, bool _requireSex, string _targetSex) external returns (address)',
  'event VerifierCreated(address indexed verifier, address indexed owner, bool requireAge, uint256 minAge, bool requireNationality, string targetNationality, bool requireSex, string targetSex)'
];

function App() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Requirements form state
  const [requireAge, setRequireAge] = useState(false);
  const [minAge, setMinAge] = useState(18);
  const [requireNationality, setRequireNationality] = useState(false);
  const [targetNationality, setTargetNationality] = useState('');
  const [requireSex, setRequireSex] = useState(false);
  const [targetSex, setTargetSex] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  };

  const deployVerifier = async () => {
    if (!(window as any).ethereum) return;

    setDeploying(true);
    setError(null);
    setDeployedAddress(null);

    try {
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const factory = new Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);

      const tx = await factory.createVerifier(
        SP1_VERIFIER_ADDRESS,
        PASSPORT_VKEY,
        requireAge,
        requireAge ? minAge : 0,
        requireNationality,
        requireNationality ? targetNationality : '',
        requireSex,
        requireSex ? targetSex : ''
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
    <div className="App">
      <header className="App-header">
        <h1>Passport Protocol</h1>
        <p>Deploy a verifier for your app</p>

        {walletAddress ? (
          <div>
            <p>Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</p>
            <button onClick={disconnectWallet}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connectWallet} disabled={connecting}>
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}

        {walletAddress && (
          <div className="form">
            <h2>Verifier Requirements</h2>

            <div className="requirement">
              <label>
                <input
                  type="checkbox"
                  checked={requireAge}
                  onChange={(e) => setRequireAge(e.target.checked)}
                />
                Require minimum age
              </label>
              {requireAge && (
                <input
                  type="number"
                  min={1}
                  max={150}
                  value={minAge}
                  onChange={(e) => setMinAge(Number(e.target.value))}
                  placeholder="Minimum age"
                />
              )}
            </div>

            <div className="requirement">
              <label>
                <input
                  type="checkbox"
                  checked={requireNationality}
                  onChange={(e) => setRequireNationality(e.target.checked)}
                />
                Require nationality
              </label>
              {requireNationality && (
                <input
                  type="text"
                  maxLength={3}
                  value={targetNationality}
                  onChange={(e) => setTargetNationality(e.target.value.toUpperCase())}
                  placeholder="e.g. MYS"
                />
              )}
            </div>

            <div className="requirement">
              <label>
                <input
                  type="checkbox"
                  checked={requireSex}
                  onChange={(e) => setRequireSex(e.target.checked)}
                />
                Require sex
              </label>
              {requireSex && (
                <select
                  value={targetSex}
                  onChange={(e) => setTargetSex(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              )}
            </div>

            <button
              className="deploy-btn"
              onClick={deployVerifier}
              disabled={deploying}
            >
              {deploying ? 'Deploying...' : 'Deploy Verifier'}
            </button>

            {error && <p className="error">{error}</p>}

            {deployedAddress && (
              <div className="result">
                <h3>Verifier Deployed</h3>
                <p className="address">{deployedAddress}</p>
              </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}

export default App;

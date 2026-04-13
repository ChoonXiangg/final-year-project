import { useState } from 'react';
import { Contract, Interface, AbiCoder, JsonRpcProvider, hexlify, BrowserProvider } from 'ethers';
import GlareHover from './components/GlareHover';
import Layout, { MONO } from './Layout';

const SEPOLIA_RPC = process.env.REACT_APP_ALCHEMY_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const APP_VERIFIER_ABI = [
  'function isVerified(address wallet) view returns (bool)',
  'function requireAge() view returns (bool)',
  'function minAge() view returns (uint256)',
  'function requireNationality() view returns (bool)',
  'function targetNationality() view returns (string)',
  'function requireSex() view returns (bool)',
  'function targetSex() view returns (string)',
  'event ClaimVerified(bytes32 indexed identityHash, address indexed wallet, address indexed verifierAddress, uint256 timestamp)',
  'function verifyClaim(bytes calldata publicValues, bytes calldata proofBytes) external',
];

interface ProofDetails {
  isVerified: boolean;
  requireAge: boolean;
  minAge: number;
  requireNationality: boolean;
  targetNationality: string;
  requireSex: boolean;
  targetSex: string;
  identityHash?: string;
  isOverMinAge?: boolean;
  proofMinAge?: number;
  isNationalityMatch?: boolean;
  proofNationality?: string;
  isSexMatch?: boolean;
  proofSex?: string;
  proofTimestamp?: number;
  txHash?: string;
}

function Verify() {
  const [userWallet, setUserWallet] = useState('');
  const [contractAddr, setContractAddr] = useState('');
  const [loading, setLoading] = useState(false);
  const [proofDetails, setProofDetails] = useState<ProofDetails | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleViewProofDetails = async () => {
    if (!userWallet || !contractAddr) return;
    setLoading(true);
    setFetchError(null);
    setProofDetails(null);

    try {
      const provider = (window as any).ethereum
        ? new BrowserProvider((window as any).ethereum)
        : new JsonRpcProvider(SEPOLIA_RPC);
      const contract = new Contract(contractAddr, APP_VERIFIER_ABI, provider);

      const [isVerifiedResult, requireAge, minAge, requireNationality, targetNationality, requireSex, targetSex] =
        await Promise.all([
          contract.isVerified(userWallet),
          contract.requireAge(),
          contract.minAge(),
          contract.requireNationality(),
          contract.targetNationality(),
          contract.requireSex(),
          contract.targetSex(),
        ]);

      const base: ProofDetails = {
        isVerified: isVerifiedResult,
        requireAge,
        minAge: Number(minAge),
        requireNationality,
        targetNationality,
        requireSex,
        targetSex,
      };

      if (isVerifiedResult) {
        const filter = contract.filters.ClaimVerified(null, userWallet, null);
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 200000);
        const events = await contract.queryFilter(filter, fromBlock, 'latest');

        if (events.length > 0) {
          const latestEvent = events[events.length - 1];
          const { identityHash } = (latestEvent as any).args;

          const tx = await provider.getTransaction(latestEvent.transactionHash);
          if (tx) {
            const iface = new Interface(['function verifyClaim(bytes calldata publicValues, bytes calldata proofBytes) external']);
            const decoded = iface.parseTransaction({ data: tx.data });
            const pvRaw: Uint8Array = decoded?.args[0];
            const pvHex = hexlify(pvRaw);

            const coder = AbiCoder.defaultAbiCoder();
            let dataToDecode = pvHex;
            const firstWord = BigInt('0x' + pvHex.slice(2, 66));
            if (firstWord === BigInt(32)) {
              dataToDecode = '0x' + pvHex.slice(66);
            }

            const [, , , isOverMinAge, proofMinAge, isNationalityMatch, proofNationality, isSexMatch, proofSex, proofTimestamp] =
              coder.decode(
                ['bytes32', 'address', 'address', 'bool', 'uint256', 'bool', 'string', 'bool', 'string', 'uint256'],
                dataToDecode
              );

            setProofDetails({
              ...base,
              identityHash: identityHash as string,
              isOverMinAge: isOverMinAge as boolean,
              proofMinAge: Number(proofMinAge),
              isNationalityMatch: isNationalityMatch as boolean,
              proofNationality: proofNationality as string,
              isSexMatch: isSexMatch as boolean,
              proofSex: proofSex as string,
              proofTimestamp: Number(proofTimestamp),
              txHash: latestEvent.transactionHash,
            });
            return;
          }
        }
      }

      setProofDetails(base);
    } catch (err: any) {
      console.error('Failed to fetch proof details:', err);
      setFetchError(err?.message ?? 'Failed to fetch proof details');
    } finally {
      setLoading(false);
    }
  };

  const TD_KEY: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #333', color: '#fff', width: '30%', ...MONO, fontSize: '0.85rem' };
  const TD_VAL: React.CSSProperties = { padding: '0.5rem 0.75rem', border: '1px solid #333', color: '#fff', ...MONO, fontSize: '0.85rem', wordBreak: 'break-all' };

  return (
    <Layout subtitle="Select your app requirements and deploy your verifier contract">
      <div style={{ position: 'absolute', top: '12rem', left: '2rem', right: '2rem', bottom: '2rem', zIndex: 1, overflowY: 'auto' }}>
        <h2 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Wallet Address</span>
        </h2>
        <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: '0 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Enter a user's wallet address</span>
        </p>
        <input
          type="text"
          placeholder="0x..."
          value={userWallet}
          onChange={e => setUserWallet(e.target.value)}
          style={{
            width: '100%',
            background: '#000',
            border: '1px solid #fff',
            color: '#fff',
            ...MONO,
            fontSize: '1rem',
            padding: '0.75rem',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        <h2 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '2rem 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Contract Address</span>
        </h2>
        <p style={{ color: '#fff', ...MONO, fontSize: '1rem', margin: '0 0 1rem 0' }}>
          <span style={{ background: '#000', padding: '0.25rem 0' }}>Enter your contract address</span>
        </p>
        <input
          type="text"
          placeholder="0x..."
          value={contractAddr}
          onChange={e => setContractAddr(e.target.value)}
          style={{
            width: '100%',
            background: '#000',
            border: '1px solid #fff',
            color: '#fff',
            ...MONO,
            fontSize: '1rem',
            padding: '0.75rem',
            boxSizing: 'border-box',
            outline: 'none',
          }}
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
          glareSize={300}
          transitionDuration={800}
          style={{ display: 'inline-grid', marginTop: '1rem' }}
        >
          <button
            onClick={handleViewProofDetails}
            disabled={loading || !userWallet || !contractAddr}
            style={{ padding: '1rem', background: 'transparent', border: 'none', color: '#fff', ...MONO, fontSize: '1rem', cursor: 'pointer' }}
          >
            {loading ? 'Loading...' : 'View Proof Details'}
          </button>
        </GlareHover>

        {fetchError && (
          <p style={{ color: '#f66', ...MONO, fontSize: '0.9rem', marginTop: '1rem' }}>Error: {fetchError}</p>
        )}

        {proofDetails && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1.5rem', background: '#000' }}>
            <tbody>
              <tr>
                <td style={TD_KEY}>Status</td>
                <td style={TD_VAL}>
                  {proofDetails.isVerified ? 'Verified' : 'Not Verified'}
                </td>
              </tr>
              {proofDetails.txHash && (
                <tr>
                  <td style={TD_KEY}>Transaction Hash</td>
                  <td style={TD_VAL}>{proofDetails.txHash}</td>
                </tr>
              )}
              {proofDetails.identityHash && (
                <tr>
                  <td style={TD_KEY}>Identity Hash</td>
                  <td style={TD_VAL}>{proofDetails.identityHash}</td>
                </tr>
              )}
              {proofDetails.proofTimestamp !== undefined && (
                <tr>
                  <td style={TD_KEY}>Timestamp</td>
                  <td style={TD_VAL}>{new Date(proofDetails.proofTimestamp * 1000).toLocaleString('en-GB', { hour12: false })}</td>
                </tr>
              )}
              <tr>
                <td style={TD_KEY}>Age Requirement</td>
                <td style={TD_VAL}>{proofDetails.requireAge ? `\u2265 ${proofDetails.minAge} years old` : 'None'}</td>
              </tr>
              {proofDetails.isOverMinAge !== undefined && (
                <tr>
                  <td style={TD_KEY}>Age Status</td>
                  <td style={TD_VAL}>
                    {proofDetails.isOverMinAge ? 'Pass' : 'Fail'}
                  </td>
                </tr>
              )}
              <tr>
                <td style={TD_KEY}>Nationality Requirement</td>
                <td style={TD_VAL}>{proofDetails.requireNationality ? proofDetails.targetNationality : 'None'}</td>
              </tr>
              {proofDetails.isNationalityMatch !== undefined && (
                <tr>
                  <td style={TD_KEY}>Nationality Status</td>
                  <td style={TD_VAL}>
                    {proofDetails.isNationalityMatch ? 'Pass' : 'Fail'}
                  </td>
                </tr>
              )}
              <tr>
                <td style={TD_KEY}>Sex Requirement</td>
                <td style={TD_VAL}>
                  {proofDetails.requireSex ? (proofDetails.targetSex === 'M' ? 'Male' : 'Female') : 'None'}
                </td>
              </tr>
              {proofDetails.isSexMatch !== undefined && (
                <tr>
                  <td style={TD_KEY}>Sex Status</td>
                  <td style={TD_VAL}>
                    {proofDetails.isSexMatch ? 'Pass' : 'Fail'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

export default Verify;

import { useState, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import { Interface } from 'ethers';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OCR_API_URL = process.env.EXPO_PUBLIC_OCR_API_URL ?? '';
const POLL_INTERVAL_MS = 60_000;
const POLL_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
const PROOF_STORAGE_KEY = 'saved_proof_result';

interface ProofResult {
  proof: string;
  publicValues: string;
  vkey: string;
}

interface Params {
  passportData: Record<string, any> | null;
  walletAddress: string | undefined;
  storedAddress: string | null;
  wcProvider: any;
}

// publicValues ABI layout (after stripping the leading 32-byte offset):
//   bytes32 identityHash  → chars 0–63
//   address walletAddress → chars 64–127  (last 40 are the address)
//   address verifierAddr  → chars 128–191 (last 40 are the address)
function extractVerifierAddress(publicValues: string): string {
  const hex = publicValues.replace(/^0x/, '');
  // skip 32-byte ABI offset (64 chars) then identityHash (64) then wallet (64)
  return '0x' + hex.slice(64 + 64 + 64 + 24, 64 + 64 + 64 + 64);
}

export function useProofGeneration({ passportData, walletAddress, storedAddress, wcProvider }: Params) {
  const [proofLoading, setProofLoading] = useState(false);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PROOF_STORAGE_KEY).then(raw => {
      if (raw) setProofResult(JSON.parse(raw));
    });
  }, []);

  const saveProof = async (proof: ProofResult) => {
    setProofResult(proof);
    await AsyncStorage.setItem(PROOF_STORAGE_KEY, JSON.stringify(proof));
  };

  const clearProof = async () => {
    setProofResult(null);
    await AsyncStorage.removeItem(PROOF_STORAGE_KEY);
  };

  const generateProof = async () => {
    if (!passportData) return;
    if (!walletAddress) {
      Alert.alert('Wallet not connected', 'Please connect your wallet first.');
      return;
    }
    if (!storedAddress) {
      Alert.alert('No contract address', 'Please enter a verifier contract address first.');
      return;
    }

    setProofLoading(true);
    try {
      const submitRes = await fetch(`${OCR_API_URL}/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passport: passportData, walletAddress, verifierAddress: storedAddress }),
      });
      const submitJson = await submitRes.json();
      if (submitJson.error) {
        Alert.alert('Error', submitJson.error);
        return;
      }
      const jobId: string = submitJson.jobId;

      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        const interval = setInterval(async () => {
          if (Date.now() > deadline) {
            clearInterval(interval);
            reject(new Error('Proof generation timed out after 3 hours'));
            return;
          }
          try {
            const statusRes = await fetch(`${OCR_API_URL}/proof-status/${jobId}`);
            const statusJson = await statusRes.json();
            if (statusJson.status === 'done') {
              clearInterval(interval);
              const { proof, publicValues, vkey } = statusJson;
              if (!proof || !publicValues || !vkey) {
                reject(new Error('Server returned incomplete proof data.'));
                return;
              }
              await saveProof({ proof, publicValues, vkey });
              resolve();
            } else if (statusJson.status === 'error') {
              clearInterval(interval);
              reject(new Error(statusJson.error ?? 'Proof generation failed'));
            }
          } catch (e) {
            clearInterval(interval);
            reject(e);
          }
        }, POLL_INTERVAL_MS);
      });

      setProofModalOpen(true);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to contact server.');
    } finally {
      setProofLoading(false);
    }
  };

  const submitProof = async (proof: ProofResult) => {
    if (!walletAddress) {
      Alert.alert('Wallet not connected', 'Please connect your wallet first.');
      return;
    }

    // Always use the verifier address baked into the proof — works even if storedAddress was cleared
    const toAddress = extractVerifierAddress(proof.publicValues);

    const iface = new Interface([
      'function verifyClaim(bytes calldata publicValues, bytes calldata proofBytes) external',
    ]);
    const calldata = iface.encodeFunctionData('verifyClaim', [
      '0x' + proof.publicValues.replace(/^0x/, ''),
      '0x' + proof.proof.replace(/^0x/, ''),
    ]);

    setSubmitting(true);
    try {
      // Simulate first to surface the actual revert reason before opening MetaMask
      const iface = new Interface([
        'function verifyClaim(bytes calldata publicValues, bytes calldata proofBytes) external',
        'error InvalidProof()',
        'error VerifierMismatch()',
        'error WalletMismatch()',
        'error TimestampTooOld()',
        'error RequirementNotMet()',
      ]);
      const simCalldata = iface.encodeFunctionData('verifyClaim', [
        '0x' + proof.publicValues.replace(/^0x/, ''),
        '0x' + proof.proof.replace(/^0x/, ''),
      ]);
      try {
        const SEPOLIA_RPC = process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
        const simRes = await fetch(SEPOLIA_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{ from: walletAddress, to: toAddress, data: simCalldata, gas: '0x7A120' }, 'latest'],
            id: 1,
          }),
        });
        const simJson = await simRes.json();
        if (simJson.error) {
          const errData: string | undefined = simJson.error?.data;
          let reason = simJson.error?.message ?? 'transaction will revert';
          console.log('sim error raw:', JSON.stringify(simJson.error));
          if (errData && errData.length >= 10) {
            try {
              const decoded = iface.parseError(errData);
              if (decoded) reason = decoded.name;
            } catch {}
          }
          Alert.alert('Cannot submit', reason);
          return;
        }
      } catch (simErr: any) {
        console.warn('Simulation network error (proceeding anyway):', simErr.message);
      }

      // Switch to Sepolia before requesting signature
      Linking.openURL('metamask://');
      try {
        await wcProvider?.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }],
        });
      } catch { /* wallet may reject silently */ }

      const currentChain = await wcProvider?.request({ method: 'eth_chainId' });
      const chainNum = typeof currentChain === 'number'
        ? currentChain
        : parseInt(String(currentChain), String(currentChain).startsWith('0x') ? 16 : 10);
      if (chainNum !== 11155111) {
        Alert.alert('Wrong Network', 'Please switch to Sepolia in MetaMask and try again.');
        return;
      }

      const txPromise = wcProvider?.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: toAddress, data: calldata }],
      });
      Linking.openURL('metamask://');
      const txHash = await txPromise;

      if (!txHash) throw new Error('Wallet did not return a transaction hash.');

      await clearProof();
      Alert.alert('Success', 'Verification submitted on-chain.');
    } catch (err: any) {
      Alert.alert('Transaction failed', err.message ?? 'Failed to submit transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return { generateProof, proofLoading, proofResult, proofModalOpen, setProofModalOpen, submitProof, submitting, clearProof };
}

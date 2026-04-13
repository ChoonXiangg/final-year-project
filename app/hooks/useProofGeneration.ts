import { useState } from 'react';
import { Alert } from 'react-native';
import { Interface } from 'ethers';

const OCR_API_URL = process.env.EXPO_PUBLIC_OCR_API_URL ?? '';
const POLL_INTERVAL_MS = 60_000;
const POLL_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

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

export function useProofGeneration({ passportData, walletAddress, storedAddress, wcProvider }: Params) {
  const [proofLoading, setProofLoading] = useState(false);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);

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
      // 1. Submit job
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

      // 2. Poll every 60 seconds until done, error, or timeout
      let completedProof: ProofResult | null = null;
      await new Promise<void>((resolve, reject) => {
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        const interval = setInterval(async () => {
          if (Date.now() > deadline) {
            clearInterval(interval);
            reject(new Error('Proof generation timed out after 1 hour'));
            return;
          }
          try {
            const statusRes = await fetch(`${OCR_API_URL}/proof-status/${jobId}`);
            const statusJson = await statusRes.json();
            if (statusJson.status === 'done') {
              clearInterval(interval);
              completedProof = {
                proof: statusJson.proof ?? '',
                publicValues: statusJson.publicValues ?? '',
                vkey: statusJson.vkey ?? '',
              };
              setProofResult(completedProof);
              resolve();
            } else if (statusJson.status === 'error') {
              clearInterval(interval);
              reject(new Error(statusJson.error ?? 'Proof generation failed'));
            }
            // else still pending — keep polling
          } catch (e) {
            clearInterval(interval);
            reject(e);
          }
        }, POLL_INTERVAL_MS);
      });

      // 3. Send verifyClaim transaction
      const result = completedProof ?? { proof: '', publicValues: '', vkey: '' };
      const iface = new Interface(['function verifyClaim(bytes calldata publicValues, bytes calldata proofBytes) external']);
      const calldata = iface.encodeFunctionData('verifyClaim', [
        '0x' + result.publicValues.replace(/^0x/, ''),
        '0x' + result.proof.replace(/^0x/, ''),
      ]);

      await wcProvider?.request({
        method: 'eth_sendTransaction',
        params: [{ from: walletAddress, to: storedAddress, data: calldata }],
      });

      setProofModalOpen(true);
    } catch (err: any) {
      Alert.alert('Proof generation failed', err.message ?? 'Failed to contact server.');
    } finally {
      setProofLoading(false);
    }
  };

  return { generateProof, proofLoading, proofResult, proofModalOpen, setProofModalOpen };
}

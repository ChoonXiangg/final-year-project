import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import { extractPassportDataFromAPI, PassportData } from '@/utils/ocr';
import { useLocalSearchParams } from 'expo-router';
import { useWallet } from '@/contexts/wallet-context';
import { Contract } from 'ethers';

const OCR_API_URL = process.env.EXPO_PUBLIC_OCR_API_URL || 'http://localhost:5000';

const APP_VERIFIER_ABI = [
  'function verifyClaim(bytes calldata publicValues, bytes calldata proofBytes) external',
];

export default function CameraScreen() {
  const params = useLocalSearchParams<{
    verifierAddress?: string;
    requireAge?: string;
    minAge?: string;
    requireNationality?: string;
    targetNationality?: string;
    requireSex?: string;
    targetSex?: string;
  }>();
  const { walletAddress, getSigner } = useWallet();

  const [facing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passportData, setPassportData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [proofGenerated, setProofGenerated] = useState(false);
  const [proofData, setProofData] = useState<{ proof: string; publicValues: string } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true });
      if (!photo) return;
      setCapturedImage(photo.uri);
      setCapturedBase64(photo.base64 ?? null);
      setPassportData(null);
      setError(null);
    } catch (err) {
      console.error('Error capturing image:', err);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedBase64(null);
    setPassportData(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!capturedBase64) return;
    setLoading(true);
    setError(null);

    const result = await extractPassportDataFromAPI(capturedBase64);

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'OCR failed. Please try again.');
      return;
    }

    if (!result.data) {
      setError('No passport MRZ detected. Please retake with the full MRZ strip visible.');
      return;
    }

    setPassportData(result.data);
  };

  const handleGenerateProof = async () => {
    if (!passportData || !walletAddress) return;

    setProofStatus('Generating ZK proof...');
    setError(null);

    try {
      const response = await fetch(`${OCR_API_URL}/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passport: passportData,
          walletAddress,
          verifierAddress: params.verifierAddress || '0x0000000000000000000000000000000000000000',
          requiredAge: params.requireAge === '1' ? Number(params.minAge) : 0,
          requiredNationality: params.requireNationality === '1' ? params.targetNationality : '',
          requiredSex: params.requireSex === '1' ? params.targetSex : '',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Proof generation failed');
      }

      const proof = await response.json();
      setProofData({ proof: proof.proof, publicValues: proof.publicValues });
      setProofStatus('Proof generated successfully');
      setProofGenerated(true);
    } catch (err: any) {
      setError(err.message || 'Failed to generate proof');
      setProofStatus(null);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofData || !params.verifierAddress) return;

    setSubmitting(true);
    setError(null);

    try {
      const signer = await getSigner();
      if (!signer) throw new Error('Wallet not connected');

      const verifier = new Contract(params.verifierAddress, APP_VERIFIER_ABI, signer);

      const publicValuesHex = proofData.publicValues.startsWith('0x')
        ? proofData.publicValues
        : '0x' + proofData.publicValues;
      const proofHex = proofData.proof.startsWith('0x')
        ? proofData.proof
        : '0x' + proofData.proof;

      const tx = await verifier.verifyClaim(publicValuesHex, proofHex);
      setTxHash(tx.hash);
      setProofStatus('Transaction sent. Waiting for confirmation...');

      await tx.wait();
      setProofStatus('Proof verified on-chain!');
    } catch (err: any) {
      setError(err.reason || err.message || 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Result screen ──────────────────────────────────────────────────────────
  if (passportData) {
    const fields: [string, string][] = [
      ['Full Name',       passportData.fullName],
      ['Nationality',     passportData.nationality],
      ['Country of Issue',passportData.issuingCountry],
      ['Document No.',    passportData.documentNumber],
      ['Date of Birth',   passportData.dateOfBirth],
      ['Date of Expiry',  passportData.dateOfExpiry],
      ['Sex',             passportData.sex],
      ['Age',             passportData.age !== null ? String(passportData.age) : '—'],
    ];

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <Text style={styles.resultHeader}>Passport Scanned</Text>
          {fields.map(([label, value]) => (
            <View key={label} style={styles.resultRow}>
              <Text style={styles.resultLabel}>{label}</Text>
              <Text style={styles.resultValue}>{value}</Text>
            </View>
          ))}
          {proofStatus && (
            <View style={styles.proofStatusBox}>
              <Text style={styles.proofStatusText}>{proofStatus}</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!proofGenerated && (
            <Pressable style={styles.generateButton} onPress={handleGenerateProof}>
              <Text style={styles.confirmButtonText}>Generate ZK Proof</Text>
            </Pressable>
          )}

          {proofGenerated && !txHash && (
            <Pressable
              style={[styles.submitButton, submitting && styles.disabledButton]}
              onPress={handleSubmitProof}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.confirmButtonText}>Submit Proof On-Chain</Text>
              }
            </Pressable>
          )}

          {txHash && (
            <View style={styles.txHashBox}>
              <Text style={styles.txHashLabel}>Transaction Hash</Text>
              <Text style={styles.txHashValue} selectable>{txHash}</Text>
            </View>
          )}

          <Pressable style={styles.scanButton} onPress={handleRetake}>
            <Text style={styles.confirmButtonText}>Scan Again</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ── Preview screen ─────────────────────────────────────────────────────────
  if (capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.previewImage} />

        <View style={styles.previewOverlay}>
          <Text style={styles.previewHeader}>Passport Captured</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.previewButtonContainer}>
            <Pressable style={styles.retakeButton} onPress={handleRetake} disabled={loading}>
              <Text style={styles.retakeButtonText}>Retake</Text>
            </Pressable>

            <Pressable style={styles.confirmButton} onPress={handleConfirm} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.confirmButtonText}>Confirm</Text>
              }
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── Camera screen ──────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

      <View style={styles.overlay}>
        <Text style={styles.header}>Please scan your passport</Text>

        <View style={styles.frameContainer}>
          <View style={styles.passportFrame} />
        </View>

        <View style={styles.buttonContainer}>
          <Pressable style={styles.captureButtonOuter} onPress={handleCapture}>
            <View style={styles.captureButtonInner} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    fontSize: 16,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 60,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  passportFrame: {
    width: '90%',
    aspectRatio: 1.42,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  buttonContainer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  captureButtonOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  previewImage: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
    paddingVertical: 60,
  },
  previewHeader: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  errorBox: {
    marginHorizontal: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  previewButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    gap: 20,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#666666',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  resultScroll: {
    padding: 24,
    paddingTop: 60,
  },
  resultHeader: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
    textAlign: 'center',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  resultLabel: {
    fontSize: 15,
    color: '#6C6C70',
    flex: 1,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
    textAlign: 'right',
  },
  generateButton: {
    backgroundColor: '#34C759',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButton: {
    backgroundColor: '#AF52DE',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  txHashBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  txHashLabel: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  txHashValue: {
    color: '#1C1C1E',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  proofStatusBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  proofStatusText: {
    color: '#007AFF',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
});

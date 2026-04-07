import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, Modal, Image, ScrollView } from 'react-native';
import { useFonts, MajorMonoDisplay_400Regular } from '@expo-google-fonts/major-mono-display';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useRef } from 'react';
import { WalletConnectModal, useWalletConnectModal } from '@walletconnect/modal-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

SplashScreen.preventAutoHideAsync();

const PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';
const OCR_API_URL = process.env.EXPO_PUBLIC_OCR_API_URL ?? '';

// Standard passport page (ICAO 9303 ID-3): 125mm × 88mm, landscape
const PASSPORT_ASPECT = 125 / 88;

const providerMetadata = {
  name: 'ZK Identity Prover',
  description: 'ZK Identity Prover mobile app',
  url: 'https://zkidentityprover.com',
  icons: ['https://zkidentityprover.com/icon.png'],
  redirect: {
    native: 'zkidentityprover://',
    universal: 'https://zkidentityprover.com',
  },
};

function WalletButton() {
  const { open, isConnected, address, provider } = useWalletConnectModal();
  const [fontsLoaded] = useFonts({ MajorMonoDisplay_400Regular });

  const handlePress = async () => {
    if (isConnected) {
      await provider?.disconnect();
    } else {
      open();
    }
  };

  const label = isConnected && address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : 'connect wallet';

  if (!fontsLoaded) return null;

  return (
    <TouchableOpacity style={styles.walletButton} onPress={handlePress} activeOpacity={0.7}>
      <Text style={styles.walletButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ MajorMonoDisplay_400Regular });
  const [contractAddress, setContractAddress] = useState('');
  const [storedAddress, setStoredAddress] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [ocrLoading, setOcrLoading] = useState(false);
  const [passportData, setPassportData] = useState<Record<string, any> | null>(null);
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofResult, setProofResult] = useState<{ proof: string; publicValues: string; vkey: string } | null>(null);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const { address: walletAddress } = useWalletConnectModal();
  const cameraRef = useRef<CameraView>(null);

  // Overlay dimensions (in screen points, computed from camera view layout)
  const overlayWidth = cameraLayout.width * 0.85;
  const overlayHeight = overlayWidth / PASSPORT_ASPECT;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const handleEnter = async () => {
    if (!contractAddress.trim()) {
      Alert.alert('Missing address', 'Please enter a verifier contract address.');
      return;
    }
    setStoredAddress(contractAddress.trim());

    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Camera permission required', 'Please allow camera access to scan your passport.');
        return;
      }
    }
    setCameraOpen(true);
  };

  const handleGenerateProof = async () => {
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
        body: JSON.stringify({
          passport: passportData,
          walletAddress,
          verifierAddress: storedAddress,
        }),
      });
      const submitJson = await submitRes.json();
      if (submitJson.error) {
        Alert.alert('Error', submitJson.error);
        return;
      }
      const jobId: string = submitJson.jobId;

      // 2. Poll every 15 seconds until done or error
      await new Promise<void>((resolve, reject) => {
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${OCR_API_URL}/proof-status/${jobId}`);
            const statusJson = await statusRes.json();
            if (statusJson.status === 'done') {
              clearInterval(interval);
              setProofResult({
                proof: statusJson.proof ?? '',
                publicValues: statusJson.publicValues ?? '',
                vkey: statusJson.vkey ?? '',
              });
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
        }, 60000);
      });

      setProofModalOpen(true);
    } catch (err: any) {
      Alert.alert('Proof generation failed', err.message ?? 'Failed to contact server.');
    } finally {
      setProofLoading(false);
    }
  };

  const handleCloseCamera = () => {
    setCameraOpen(false);
    setCapturedImage(null);
    setOcrLoading(false);
  };

  const handleConfirm = async () => {
    if (!capturedImage) return;
    setOcrLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: capturedImage,
        type: 'image/jpeg',
        name: 'passport.jpg',
      } as any);
      const response = await fetch(`${OCR_API_URL}/ocr/passport`, {
        method: 'POST',
        body: formData,
      });
      const text = await response.text();
      if (!text) {
        Alert.alert('OCR failed', 'Server returned an empty response. Check the OCR server logs.');
        return;
      }
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        Alert.alert('OCR failed', `Invalid server response:\n${text.slice(0, 200)}`);
        return;
      }
      if (!json.success) {
        Alert.alert('OCR failed', json.error ?? 'Unknown error');
        return;
      }
      if (!json.data) {
        Alert.alert('No passport found', 'Could not detect passport data. Please retake the photo.');
        return;
      }
      setPassportData(json.data);
      setCameraOpen(false);
      setCapturedImage(null);
      setPassportModalOpen(true);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to contact OCR service.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current || cameraLayout.width === 0) return;

    const photo = await cameraRef.current.takePictureAsync({ skipProcessing: false });
    if (!photo) return;

    // --- Map overlay screen coordinates → photo pixel coordinates ---
    //
    // The CameraView uses "cover" scaling: it scales the sensor image
    // so it completely fills the view, cropping the excess. This means
    // the full photo has MORE content than what's visible on screen.
    //
    // Step 1: figure out the scale factor and how much of the photo
    //         is hidden (the offset) on each axis.
    const previewAspect = cameraLayout.width / cameraLayout.height;
    const photoAspect = photo.width / photo.height;

    let scaleFactor: number;
    let photoOffsetX: number;
    let photoOffsetY: number;

    if (photoAspect > previewAspect) {
      // Photo is wider than the preview → height fills exactly,
      // left/right edges of the photo are cropped off-screen.
      scaleFactor = photo.height / cameraLayout.height;
      photoOffsetX = (photo.width - cameraLayout.width * scaleFactor) / 2;
      photoOffsetY = 0;
    } else {
      // Photo is taller than the preview → width fills exactly,
      // top/bottom edges of the photo are cropped off-screen.
      scaleFactor = photo.width / cameraLayout.width;
      photoOffsetX = 0;
      photoOffsetY = (photo.height - cameraLayout.height * scaleFactor) / 2;
    }

    // Step 2: the overlay is centered on screen.
    const overlayX = (cameraLayout.width - overlayWidth) / 2;
    const overlayY = (cameraLayout.height - overlayHeight) / 2;

    // Step 3: convert screen-space overlay rect → photo-space crop rect.
    const cropX = Math.max(0, Math.round(photoOffsetX + overlayX * scaleFactor));
    const cropY = Math.max(0, Math.round(photoOffsetY + overlayY * scaleFactor));
    const cropW = Math.min(Math.round(overlayWidth * scaleFactor), photo.width - cropX);
    const cropH = Math.min(Math.round(overlayHeight * scaleFactor), photo.height - cropY);

    const cropped = await manipulateAsync(
      photo.uri,
      [
        { crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } },
        { resize: { width: 800 } },
      ],
      { format: SaveFormat.JPEG, compress: 0.6 },
    );

    setCapturedImage(cropped.uri);
  };

  return (
    <View style={styles.container}>
      <WalletButton />
      <Text style={styles.title}>zk identity prover</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="app verifier contract address"
          placeholderTextColor="#555"
          value={contractAddress}
          onChangeText={setContractAddress}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.contractButton} activeOpacity={0.7} onPress={handleEnter}>
          <Text style={styles.contractButtonText}>enter</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={handleCloseCamera}>
        {capturedImage ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: capturedImage }} style={styles.previewImage} resizeMode="contain" />
            <View style={styles.previewButtons}>
              <TouchableOpacity
                style={[styles.previewButton, ocrLoading && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleConfirm}
                disabled={ocrLoading}
              >
                <Text style={styles.previewButtonText}>{ocrLoading ? 'reading...' : 'confirm'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewButton}
                activeOpacity={0.7}
                onPress={() => setCapturedImage(null)}
              >
                <Text style={styles.previewButtonText}>cancel</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseCamera} activeOpacity={0.7}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={styles.cameraContainer}
            onLayout={(e) => setCameraLayout({
              width: e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            })}
          >
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />

            {/* Semi-transparent overlay with passport cutout */}
            {cameraLayout.width > 0 && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Top dark bar */}
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                {/* Middle row: dark | passport hole | dark */}
                <View style={{ flexDirection: 'row', height: overlayHeight }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                  <View style={{ width: overlayWidth, borderWidth: 2, borderColor: '#ffffff' }} />
                  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
                </View>
                {/* Bottom dark bar */}
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
              </View>
            )}

            {/* Close (✕) button — top right */}
            <TouchableOpacity style={styles.closeButton} onPress={handleCloseCamera} activeOpacity={0.7}>
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            {/* Capture button — iPhone style */}
            <TouchableOpacity style={styles.captureButton} activeOpacity={0.8} onPress={handleCapture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      <Modal visible={passportModalOpen} animationType="fade" onRequestClose={() => setPassportModalOpen(false)}>
        <View style={styles.passportModalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setPassportModalOpen(false)} activeOpacity={0.7}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.passportModalTitle}>passport data</Text>
          {passportData && (
            <>
              <ScrollView style={styles.passportScroll} contentContainerStyle={styles.passportScrollContent}>
                {[
                  ['document no.',    passportData.documentNumber],
                  ['name',            passportData.name],
                  ['nationality',     passportData.nationality],
                  ['date of birth',   passportData.dateOfBirth],
                  ['sex',             passportData.sex],
                  ['identity no.',    passportData.personalNumber],
                  ['date of expiry',  passportData.dateOfExpiry],
                  ['issuing country', passportData.issuingCountry],
                ].filter(([, v]) => v !== undefined && v !== null && v !== '').map(([label, value]) => (
                  <View key={label as string} style={styles.passportRow}>
                    <Text style={styles.passportLabel}>{label as string}</Text>
                    <Text style={styles.passportValue}>{String(value)}</Text>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.generateProofButton, proofLoading && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleGenerateProof}
                disabled={proofLoading}
              >
                <Text style={styles.generateProofButtonText}>{proofLoading ? 'generating...' : 'generate proof'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      <Modal visible={proofModalOpen} animationType="fade" onRequestClose={() => setProofModalOpen(false)}>
        <View style={styles.passportModalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={() => setProofModalOpen(false)} activeOpacity={0.7}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.passportModalTitle}>proof</Text>
          {proofResult && (
            <ScrollView style={styles.passportScroll} contentContainerStyle={styles.passportScrollContent}>
              {[
                ['vkey',          proofResult.vkey],
                ['public values', proofResult.publicValues],
                ['proof',         proofResult.proof],
              ].map(([label, value]) => (
                <View key={label} style={styles.passportRow}>
                  <Text style={styles.passportLabel}>{label}</Text>
                  <Text style={styles.passportValue} numberOfLines={4} ellipsizeMode="middle">
                    {value}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <StatusBar style="light" />
      <WalletConnectModal
        projectId={PROJECT_ID}
        providerMetadata={providerMetadata}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060010',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 22,
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 2,
    paddingHorizontal: 24,
  },
  walletButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  walletButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: 32,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  input: {
    flex: 1,
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  contractButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    borderLeftWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  contractButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '300',
  },
  captureButton: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    aspectRatio: PASSPORT_ASPECT,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  previewButtons: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 16,
  },
  previewButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  previewButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  passportModalContainer: {
    flex: 1,
    backgroundColor: '#060010',
    paddingTop: 100,
    paddingHorizontal: 24,
  },
  passportModalTitle: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 32,
    textAlign: 'center',
  },
  passportScroll: {
    flex: 1,
  },
  passportScrollContent: {
    gap: 1,
  },
  passportRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#ffffff',
    marginBottom: -1,
  },
  passportLabel: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 15,
    color: '#ffffff',
    width: 150,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#ffffff',
  },
  passportValue: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 15,
    color: '#ffffff',
    flex: 1,
    padding: 12,
  },
  generateProofButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 48,
  },
  generateProofButtonText: {
    fontFamily: 'MajorMonoDisplay_400Regular',
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

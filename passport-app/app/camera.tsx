import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, Image, ActivityIndicator, ScrollView } from 'react-native';
import { extractPassportDataFromAPI, PassportData } from '@/utils/ocr';

export default function CameraScreen() {
  const [facing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passportData, setPassportData] = useState<PassportData | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
});

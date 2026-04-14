import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useFonts, MajorMonoDisplay_400Regular } from '@expo-google-fonts/major-mono-display';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { WalletConnectModal, useWalletConnectModal } from '@walletconnect/modal-react-native';
import { JsonRpcProvider, Contract, isAddress } from 'ethers';
import WalletButton from './components/WalletButton';
import CameraModal from './components/CameraModal';
import PassportModal from './components/PassportModal';
import ProofModal from './components/ProofModal';
import QRScanModal from './components/QRScanModal';
import { useProofGeneration } from './hooks/useProofGeneration';

SplashScreen.preventAutoHideAsync();

const PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';
const SEPOLIA_RPC = process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
const APP_VERIFIER_ABI = ['function requireAge() view returns (bool)'];

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

export default function App() {
  const [fontsLoaded] = useFonts({ MajorMonoDisplay_400Regular });
  const [contractAddress, setContractAddress] = useState('');
  const [storedAddress, setStoredAddress] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [passportData, setPassportData] = useState<Record<string, any> | null>(null);
  const [passportModalOpen, setPassportModalOpen] = useState(false);
  const { address: walletAddress, provider: wcProvider } = useWalletConnectModal();

  const { generateProof, proofLoading, proofResult, proofModalOpen, setProofModalOpen, submitProof, submitting } =
    useProofGeneration({ passportData, walletAddress, storedAddress, wcProvider });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  const handleEnterWithAddress = async (addr: string) => {
    if (!isAddress(addr)) {
      Alert.alert('Invalid address', 'That does not look like a valid Ethereum address.');
      return;
    }
    try {
      const provider = new JsonRpcProvider(SEPOLIA_RPC);
      const contract = new Contract(addr, APP_VERIFIER_ABI, provider);
      await contract.requireAge();
    } catch {
      Alert.alert('Invalid contract', 'Could not verify this address as an AppVerifier contract. Make sure you are on Sepolia and the address is correct.');
      return;
    }
    setStoredAddress(addr);
    setCameraOpen(true);
  };

  const handleEnter = async () => {
    const addr = contractAddress.trim();
    if (!addr) {
      Alert.alert('Missing address', 'Please enter a verifier contract address.');
      return;
    }
    await handleEnterWithAddress(addr);
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
        <TouchableOpacity style={styles.qrButton} activeOpacity={0.7} onPress={() => setQrScanOpen(true)}>
          <Text style={styles.contractButtonText}>qr</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contractButton} activeOpacity={0.7} onPress={handleEnter}>
          <Text style={styles.contractButtonText}>enter</Text>
        </TouchableOpacity>
      </View>

      <QRScanModal
        visible={qrScanOpen}
        onClose={() => setQrScanOpen(false)}
        onAddressScanned={(address) => {
          setContractAddress(address);
          setQrScanOpen(false);
          // validate and proceed directly — no need to tap enter after scanning
          setTimeout(() => handleEnterWithAddress(address), 0);
        }}
      />

      <CameraModal
        visible={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onPassportScanned={(data) => { setPassportData(data); setPassportModalOpen(true); }}
      />

      <PassportModal
        visible={passportModalOpen}
        passportData={passportData}
        onClose={() => setPassportModalOpen(false)}
        onGenerateProof={generateProof}
        proofLoading={proofLoading}
      />

      <ProofModal
        visible={proofModalOpen}
        proofResult={proofResult}
        onClose={() => setProofModalOpen(false)}
        onSubmit={() => proofResult && submitProof(proofResult)}
        submitting={submitting}
      />

      <StatusBar style="light" />
      <WalletConnectModal projectId={PROJECT_ID} providerMetadata={providerMetadata} />
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
  qrButton: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#ffffff',
    borderLeftWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 12,
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
});

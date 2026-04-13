import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useFonts, MajorMonoDisplay_400Regular } from '@expo-google-fonts/major-mono-display';
import { useWalletConnectModal } from '@walletconnect/modal-react-native';

export default function WalletButton() {
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

const styles = StyleSheet.create({
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
});

import { StyleSheet, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { useWallet } from '@/contexts/wallet-context';

export default function HomeScreen() {
  const router = useRouter();
  const { walletAddress, connectWallet, disconnectWallet, isConnecting } = useWallet();

  const handleScanPassport = () => {
    router.push('/verifier');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>ZK Identity</ThemedText>

        {walletAddress ? (
          <ThemedView style={styles.walletSection}>
            <ThemedText style={styles.walletLabel}>Connected Wallet</ThemedText>
            <ThemedText style={styles.walletAddress}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </ThemedText>
            <Pressable style={styles.disconnectButton} onPress={disconnectWallet}>
              <ThemedText style={styles.disconnectText}>Disconnect</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <ThemedView style={styles.walletSection}>
            <Pressable
              style={[styles.connectButton, isConnecting && styles.disabledButton]}
              onPress={connectWallet}
              disabled={isConnecting}
            >
              <ThemedText style={styles.buttonText}>
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <Pressable
          style={[styles.scanButton, !walletAddress && styles.disabledButton]}
          onPress={handleScanPassport}
          disabled={!walletAddress}
        >
          <ThemedText style={styles.buttonText}>Scan Passport</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 40,
  },
  walletSection: {
    marginBottom: 40,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  walletLabel: {
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.7,
  },
  walletAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  connectButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  disconnectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  disconnectText: {
    color: '#ff4444',
    fontSize: 14,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

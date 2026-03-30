import { useState } from 'react';
import { StyleSheet, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRouter } from 'expo-router';
import { isAddress, JsonRpcProvider, Contract } from 'ethers';

const APP_VERIFIER_ABI = [
  'function requireAge() view returns (bool)',
  'function requireNationality() view returns (bool)',
  'function requireSex() view returns (bool)',
  'function minAge() view returns (uint256)',
  'function targetNationality() view returns (string)',
  'function targetSex() view returns (string)',
];

// TODO: Update after deploying to Sepolia
const RPC_URL = 'https://sepolia.infura.io/v3/placeholder';

interface Requirements {
  requireAge: boolean;
  minAge: number;
  requireNationality: boolean;
  targetNationality: string;
  requireSex: boolean;
  targetSex: string;
}

export default function VerifierScreen() {
  const router = useRouter();
  const [verifierAddress, setVerifierAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requirements, setRequirements] = useState<Requirements | null>(null);

  const readRequirements = async () => {
    setError('');
    setRequirements(null);

    if (!isAddress(verifierAddress.trim())) {
      setError('Invalid contract address');
      return;
    }

    setLoading(true);
    try {
      const provider = new JsonRpcProvider(RPC_URL);
      const contract = new Contract(verifierAddress.trim(), APP_VERIFIER_ABI, provider);

      const [reqAge, reqNat, reqSex, minAge, targetNat, targetSex] = await Promise.all([
        contract.requireAge(),
        contract.requireNationality(),
        contract.requireSex(),
        contract.minAge(),
        contract.targetNationality(),
        contract.targetSex(),
      ]);

      setRequirements({
        requireAge: reqAge,
        minAge: Number(minAge),
        requireNationality: reqNat,
        targetNationality: targetNat,
        requireSex: reqSex,
        targetSex: targetSex,
      });
    } catch (err: any) {
      setError('Failed to read contract. Is this a valid AppVerifier?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    router.push({
      pathname: '/camera',
      params: {
        verifierAddress: verifierAddress.trim(),
        requireAge: requirements?.requireAge ? '1' : '0',
        minAge: String(requirements?.minAge ?? 0),
        requireNationality: requirements?.requireNationality ? '1' : '0',
        targetNationality: requirements?.targetNationality ?? '',
        requireSex: requirements?.requireSex ? '1' : '0',
        targetSex: requirements?.targetSex ?? '',
      },
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>Verifier</ThemedText>
        <ThemedText style={styles.subtitle}>Enter the app's verifier contract address</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="0x..."
          placeholderTextColor="#888"
          value={verifierAddress}
          onChangeText={setVerifierAddress}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Pressable style={styles.readButton} onPress={readRequirements} disabled={loading}>
          <ThemedText style={styles.buttonText}>
            {loading ? 'Reading...' : 'Read Requirements'}
          </ThemedText>
        </Pressable>

        {loading && <ActivityIndicator style={styles.loader} color="#007AFF" />}
        {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

        {requirements && (
          <ThemedView style={styles.requirementsCard}>
            <ThemedText style={styles.cardTitle}>Requirements</ThemedText>

            {requirements.requireAge && (
              <ThemedText style={styles.reqItem}>
                Age: {requirements.minAge}+
              </ThemedText>
            )}
            {requirements.requireNationality && (
              <ThemedText style={styles.reqItem}>
                Nationality: {requirements.targetNationality}
              </ThemedText>
            )}
            {requirements.requireSex && (
              <ThemedText style={styles.reqItem}>
                Sex: {requirements.targetSex === 'M' ? 'Male' : 'Female'}
              </ThemedText>
            )}
            {!requirements.requireAge && !requirements.requireNationality && !requirements.requireSex && (
              <ThemedText style={styles.reqItem}>No specific requirements</ThemedText>
            )}

            <Pressable style={styles.proceedButton} onPress={handleProceed}>
              <ThemedText style={styles.buttonText}>Scan Passport & Prove</ThemedText>
            </Pressable>
          </ThemedView>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#fff',
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  readButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginVertical: 12,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 13,
    marginTop: 8,
  },
  requirementsCard: {
    marginTop: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  reqItem: {
    fontSize: 15,
    marginBottom: 6,
  },
  proceedButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
});

import { testAppwriteConnection } from '@/lib/appwrite/testConnection';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  const [status, setStatus] = useState('Connecting to Appwrite...');

  useEffect(() => {
    testAppwriteConnection()
      .then((response) => {
        setStatus(`Connected successfully\n\nAppwrite response: ${response}`);
      })
      .catch((error) => {
        console.error(error);
        setStatus(
          `Connection failed\n\n${error?.message ?? 'Unknown error'}`
        );
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DonorLink</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
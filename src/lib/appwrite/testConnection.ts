import client from './client';

export async function testAppwriteConnection(): Promise<string> {
  try {
    const response = await client.ping();

    return String(response);
  } catch (error) {
    console.error('Appwrite connection failed:', error);
    throw error;
  }
}
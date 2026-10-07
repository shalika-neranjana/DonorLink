import { LogBox } from 'react-native';
import { Account, Client, Functions, Realtime, Storage, TablesDB } from 'react-native-appwrite';
import 'react-native-url-polyfill/auto';

import { appwriteConfig } from './config';
import { installLocalStorageFallback } from './sessionFallback';

// Must run before the SDK handles its first response (see sessionFallback.ts).
installLocalStorageFallback();
// The SDK prints this advisory whenever it uses the fallback; it is expected here.
LogBox.ignoreLogs(['Appwrite is using localStorage for session management']);

const client = new Client();

client
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId)
  .setPlatform(appwriteConfig.platform);

export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export const realtime = new Realtime(client);

export default client;

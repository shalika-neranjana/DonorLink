const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = withNativewind(getDefaultConfig(__dirname));

/**
 * react-native-appwrite@1.x targets expo-file-system 18 and calls its legacy API
 * (readAsStringAsync, cacheDirectory...) for file uploads. Expo SDK 57 ships that
 * API under `expo-file-system/legacy`, so imports that originate inside the
 * Appwrite SDK are redirected there. This keeps a single native module installed
 * (see "overrides" in package.json) and keeps SDK uploads working.
 */
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = upstreamResolve ?? context.resolveRequest;
  if (moduleName === 'expo-file-system' && /[\\/]react-native-appwrite[\\/]/.test(context.originModulePath)) {
    return resolve(context, 'expo-file-system/legacy', platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;

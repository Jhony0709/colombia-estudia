// En el monorepo conviven React 18 (web) y el de Expo: React, React Native, Reanimated, worklets y safe-area
// se resuelven siempre desde esta app (fluxus/examples/native/metro.config.js).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

const ONE_OF_EACH = [
  'react',
  'react-native',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-safe-area-context',
  'react-native-svg',
  'expo-haptics',
];
const here = path.join(projectRoot, 'package.json');
config.resolver.resolveRequest = (context, name, platform) => {
  const single = ONE_OF_EACH.some((pkg) => name === pkg || name.startsWith(`${pkg}/`));
  return context.resolveRequest(
    single ? { ...context, originModulePath: here } : context,
    name,
    platform
  );
};

module.exports = config;

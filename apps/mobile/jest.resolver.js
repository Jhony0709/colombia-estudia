// El resolver de Reanimated decide qué módulos suyos y de worklets cargan en versión de Jest con
// `basedir.includes('react-native-worklets')`; con pnpm casi toda ruta lo contiene
// (.pnpm/expo@…_react-native-worklets@…/node_modules/expo) y Expo y Reanimated acaban en su versión
// web. Se le da un basedir que responde solo por la carpeta real del paquete, y la resolución sigue
// con el de React Native (el del preset de Expo) y el basedir de verdad.
const path = require('path');
const native = require('@react-native/jest-preset/jest/resolver');
const reanimated = require('react-native-reanimated/jest/resolver');

const packageDir = (dir) =>
  Object.assign(new String(dir), {
    includes: (name) => dir.includes(`${path.sep}node_modules${path.sep}${name}${path.sep}`),
  });

module.exports = (request, options) =>
  reanimated(request, {
    ...options,
    basedir: packageDir(options.basedir),
    defaultResolver: (next, nextOptions) =>
      native(next, {
        ...nextOptions,
        basedir: options.basedir,
        defaultResolver: options.defaultResolver,
      }),
  });

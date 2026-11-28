// babel-preset-expo ya añade el plugin de worklets que pide Reanimated 4.
module.exports = (api) => {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    // react-native-reanimated/plugin must be listed LAST.
    // babel-preset-expo applies React Compiler before this plugin runs.
    plugins: ["react-native-reanimated/plugin"],
  };
};

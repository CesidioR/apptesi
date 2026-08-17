const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("sql");
config.resolver.assetExts.push("onnx");
// Assicurati che il percorso corrisponda a dove si trova il tuo global.css
module.exports = withNativeWind(config, { input: "./src/styles/global.css" });

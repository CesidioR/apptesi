// Forza l'autolinking di onnxruntime-react-native su Android.
// Il pacchetto usa il vecchio formato `unimodule.json`, che l'autolinking di
// Expo SDK 54 non rileva -> il progetto non finisce in settings.gradle e il
// package non viene registrato (NativeModules.Onnxruntime == null).
// Qui lo dichiariamo a mano: cosi' viene incluso come progetto Gradle E
// registrato in PackageList. Sopravvive a `prebuild --clean`.
// iOS resta gestito dal config plugin (pod) in app.json.
module.exports = {
  dependencies: {
    "onnxruntime-react-native": {
      // `root` e' OBBLIGATORIO per l'autolinking di Expo SDK 54
      // (expo-modules-autolinking/build/dependencies/rncliLocal.js: scarta le
      // dipendenze senza `root`). Senza questo, NativeModules.Onnxruntime == null.
      root: "./node_modules/onnxruntime-react-native",
      platforms: {
        android: {
          // sourceDir e' relativo a `root` (packageRoot), NON al progetto:
          // l'androidResolver fa path.join(packageRoot, sourceDir).
          sourceDir: "android",
          packageImportPath: "import ai.onnxruntime.reactnative.OnnxruntimePackage;",
          packageInstance: "new OnnxruntimePackage()",
        },
      },
    },
  },
};

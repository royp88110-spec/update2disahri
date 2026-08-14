// Config plugin: adds Android <queries> block for UPI intent visibility.
// Required on Android 11+ (API 30+) so Linking.openURL("upi://...") works
// in release/APK builds without needing Linking.canOpenURL() to return true.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withUpiQueries(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;

    // Ensure <queries> array exists
    if (!manifest.queries) {
      manifest.queries = [];
    }

    // Check we haven't already added this entry
    const alreadyAdded = manifest.queries.some(
      (q) =>
        q.intent &&
        q.intent.some(
          (i) =>
            i.action?.[0]?.["$"]?.["android:name"] ===
              "android.intent.action.VIEW" &&
            i.data?.[0]?.["$"]?.["android:scheme"] === "upi"
        )
    );

    if (!alreadyAdded) {
      manifest.queries.push({
        intent: [
          {
            action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
            data: [{ $: { "android:scheme": "upi" } }],
          },
        ],
      });
    }

    return androidConfig;
  });
};

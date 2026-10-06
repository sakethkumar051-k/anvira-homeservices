import type { ExpoConfig, ConfigContext } from "expo/config";
export default function ({ config }: ConfigContext): ExpoConfig {
  const live = process.env.EXPO_PUBLIC_AUTH_MODE === "firebase",
    platform = process.env.EAS_BUILD_PLATFORM;
  const iosFile = process.env.GOOGLE_SERVICES_IOS,
    androidFile = process.env.GOOGLE_SERVICES_ANDROID;
  if (live && platform === "ios" && !iosFile)
    throw new Error(
      "GOOGLE_SERVICES_IOS must point to the Firebase iOS configuration file.",
    );
  if (live && platform === "android" && !androidFile)
    throw new Error(
      "GOOGLE_SERVICES_ANDROID must point to the Firebase Android configuration file.",
    );
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    "expo-router",
    "expo-apple-authentication",
    "expo-font",
    "expo-web-browser",
    "expo-sharing",
    "expo-document-picker",
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow ANVIRA to choose your professional profile photo.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ["expo-notifications", { color: "#12634F" }],
    [
      "expo-build-properties",
      {
        ios: { deploymentTarget: "16.4", useFrameworks: "static" },
        android: { usesCleartextTraffic: !live },
      },
    ],
  ];
  if (live && (iosFile || androidFile))
    plugins.push("@react-native-firebase/app");
  // The Auth plugin only adds phone-auth CAPTCHA handlers; those are no longer needed.
  if (live && (iosFile || androidFile))
    plugins.push("react-native-nitro-google-signin");
  return {
    ...config,
    name: "ANVIRA",
    slug: "anvira",
    version: "1.2.0",
    scheme: "anvira",
    ios: {
      ...config.ios,
      supportsTablet: false,
      usesAppleSignIn: true,
      ...(iosFile ? { googleServicesFile: iosFile } : {}),
      infoPlist: {
        ...config.ios?.infoPlist,
        ...(!live
          ? {
              NSAppTransportSecurity: {
                NSAllowsArbitraryLoads: true,
                NSAllowsLocalNetworking: true,
              },
            }
          : {}),
      },
    },
    android: {
      ...config.android,
      ...(androidFile ? { googleServicesFile: androidFile } : {}),
    },
    plugins,
    extra: {
      ...config.extra,
      ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
        ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
        : {}),
    },
  };
}

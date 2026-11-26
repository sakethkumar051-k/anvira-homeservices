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
  // A store build without an HTTPS API cannot start (see runtime.ts), so
  // fail the cloud build instead of shipping an app that crashes on launch.
  if (
    live &&
    platform &&
    process.env.EAS_BUILD_PROFILE !== "development" &&
    !process.env.EXPO_PUBLIC_API_URL?.startsWith("https://")
  )
    throw new Error(
      "EXPO_PUBLIC_API_URL must be an HTTPS URL for native release builds.",
    );
  const plugins: NonNullable<ExpoConfig["plugins"]> = [
    "expo-router",
    "expo-apple-authentication",
    "expo-font",
    "expo-secure-store",
    "expo-status-bar",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 220,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
      },
    ],
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
    [
      "expo-notifications",
      {
        color: "#12634F",
        sounds: ["./assets/sounds/partner_offer.wav"],
        enableBackgroundRemoteNotifications: live,
      },
    ],
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
  if (live && (iosFile || androidFile))
    plugins.push("@react-native-firebase/auth");
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
      // Only standard HTTPS/TLS encryption: skips the export-compliance prompt.
      config: { ...config.ios?.config, usesNonExemptEncryption: false },
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
      // Google Play restricts broad media/storage access. Photos are chosen
      // with the system photo picker, so these permissions are not needed.
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.RECORD_AUDIO",
        "android.permission.CAMERA",
        "android.permission.SYSTEM_ALERT_WINDOW",
      ],
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

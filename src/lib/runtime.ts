import { Platform } from "react-native";
export const LIVE = process.env.EXPO_PUBLIC_AUTH_MODE === "firebase";
export const WEBSITE_STAFF_ONLY =
  Platform.OS === "web" &&
  process.env.EXPO_PUBLIC_WEBSITE_STAFF_ONLY === "true";
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web"
    ? window.location.origin
    : LIVE
      ? "http://10.0.2.2:4000"
      : "http://10.0.2.2:4001");
export function assertApiConfiguration() {
  if (LIVE && Platform.OS !== "web" && !__DEV__) {
    try {
      const url = new URL(process.env.EXPO_PUBLIC_API_URL || "");
      if (url.protocol === "https:" && url.hostname) return;
    } catch {}
    throw new Error("Live app releases require an HTTPS API URL.");
  }
  if (
    LIVE &&
    !API_BASE.startsWith("https://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(API_BASE)
  )
    throw new Error("Live authentication requires an HTTPS API URL.");
}

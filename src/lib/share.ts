import { Linking, Platform, Share } from "react-native";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Copies text on the web; returns false when the browser blocks it. */
export async function copyText(text: string) {
  if (Platform.OS !== "web") return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Opens the system share sheet on phones; copies the message on the web. */
export async function shareMessage(
  message: string,
  title = "ANVIRA",
): Promise<ShareResult> {
  try {
    if (Platform.OS === "web") {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({ title, text: message });
          return "shared";
        } catch (e) {
          if ((e as Error).name === "AbortError") return "cancelled";
        }
      }
      return (await copyText(message)) ? "copied" : "failed";
    }
    const result = await Share.share({ message, title });
    return result.action === Share.dismissedAction ? "cancelled" : "shared";
  } catch {
    return "failed";
  }
}

export function whatsappUrl(message: string, phone = "") {
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? "91" + digits : digits;
  return "https://wa.me/" + to + "?text=" + encodeURIComponent(message);
}

export async function openWhatsApp(message: string, phone = "") {
  try {
    await Linking.openURL(whatsappUrl(message, phone));
    return true;
  } catch {
    return false;
  }
}

export const WEBSITE_URL = "https://anviraservices.com";

export function normalizeMobileNumber(value: string) {
  const digits = value.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const local =
    digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(local))
    throw new Error("Enter a valid 10-digit Indian mobile number.");
  return "+91" + local;
}
export function validateVerificationCode(value: string) {
  const code = value.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code))
    throw new Error("Enter the 6-digit code from your SMS.");
  return code;
}
export function customerReturnTo(value?: string) {
  if (!value || value.length > 1800) return "/home";
  if (
    /^\/checkout\/[a-zA-Z0-9_-]+\?(?:packageId=[a-zA-Z0-9_-]+&)?addonIds=(?:[a-zA-Z0-9_-]+(?:,[a-zA-Z0-9_-]+)*)?(?:&entryId=[a-zA-Z0-9_-]+)?$/.test(
      value,
    )
  )
    return value;
  return /^(?:\/(?:checkout|service)\/[a-zA-Z0-9_-]+(?:\?packageId=[a-zA-Z0-9_-]+)?|\/bookings|\/quotes\?serviceId=[a-zA-Z0-9_-]+(?:&packageId=[a-zA-Z0-9_-]+)?)$/.test(
    value,
  )
    ? value
    : "/home";
}
export function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw new Error("Enter a valid email address.");
}
export function validateRegistration(
  name: string,
  password: string,
  confirmation: string,
) {
  if (name.trim().length < 2 || name.trim().length > 100)
    throw new Error("Enter your name (2–100 characters).");
  if (password.length < 8)
    throw new Error("Choose a password with at least 8 characters.");
  if (password !== confirmation) throw new Error("The passwords do not match.");
}
export function signInError(error: unknown) {
  const e = error as { code?: string; message?: string };
  const messages: Record<string, string> = {
    "auth/invalid-phone-number": "Enter a valid 10-digit Indian mobile number.",
    "auth/missing-phone-number": "Enter your mobile number to receive a code.",
    "auth/invalid-verification-code":
      "That code is incorrect. Check your SMS and try again.",
    "auth/missing-verification-code": "Enter the 6-digit code from your SMS.",
    "auth/code-expired":
      "That code has expired. Request a new code and try again.",
    "auth/session-expired":
      "That code has expired. Request a new code and try again.",
    "auth/invalid-verification-id":
      "That code has expired. Request a new code and try again.",
    "auth/quota-exceeded":
      "The SMS delivery limit has been reached. Please use Google or email, or try later.",
    "auth/billing-not-enabled":
      "SMS sign-in is not available yet. Please use Google or email while ANVIRA enables it.",
    "auth/captcha-check-failed":
      "The security check could not finish. Request the code again, or use Google or email.",
    "auth/missing-app-credential":
      "The security check could not finish. Please try again or use Google or email.",
    "auth/invalid-app-credential":
      "Phone sign-in needs this app’s verification setup. Please use Google or email for now.",
    "auth/app-not-authorized":
      "Phone sign-in needs this app’s signing configuration. Please use Google or email for now.",
    "auth/invalid-app-id":
      "Phone sign-in needs this app’s configuration. Please use Google or email for now.",
    "auth/operation-not-allowed":
      "This sign-in method is not enabled yet. Please use email/password or contact ANVIRA support.",
    "auth/unauthorized-domain":
      "This sign-in method is not approved for this website yet. Please use email/password.",
    "auth/popup-blocked":
      "Allow pop-ups for this website, then try Google sign-in again. You can also use email/password.",
    "auth/popup-closed-by-user": "Google sign-in cancelled. You can try again.",
    "auth/cancelled-popup-request":
      "A Google sign-in window is already open. Finish it or try again.",
    "auth/account-exists-with-different-credential":
      "This email already uses another sign-in method. Sign in with your existing method first.",
    "auth/email-already-in-use":
      "This email already has an account. Sign in or reset your password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password":
      "Choose a stronger password with at least 8 characters.",
    "auth/password-does-not-meet-requirements":
      "Choose a stronger password that meets this account’s password requirements.",
    "auth/invalid-credential":
      "The email or password did not match. Try again or reset your password.",
    "auth/wrong-password":
      "The email or password did not match. Try again or reset your password.",
    "auth/user-not-found":
      "The email or password did not match. Try again or reset your password.",
    "auth/user-disabled": "This account is disabled. Contact ANVIRA support.",
    "auth/too-many-requests":
      "Too many attempts. Please wait a few minutes before trying again.",
    "auth/network-request-failed":
      "Check your internet connection and try again.",
    PLAY_SERVICES_NOT_AVAILABLE:
      "Update Google Play Services or use email/password.",
    DEVELOPER_ERROR:
      "Google sign-in needs this app’s signing configuration. Please use email/password.",
    ERR_REQUEST_CANCELED: "Apple sign-in cancelled. You can try again.",
    SIGN_IN_CANCELLED: "Google sign-in cancelled. You can try again.",
  };
  return (
    (e?.code && messages[e.code]) ||
    e?.message ||
    "Sign-in could not finish. Please try again."
  );
}

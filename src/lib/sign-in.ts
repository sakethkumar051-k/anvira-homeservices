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
    "auth/operation-not-allowed":
      "This sign-in method is not enabled yet. Please use email/password or contact ANVIRA support.",
    "auth/unauthorized-domain":
      "Google sign-in is not approved for this website yet. Please use email/password.",
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

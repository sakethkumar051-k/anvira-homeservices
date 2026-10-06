async function instance() {
  const sdk = await import("@react-native-firebase/auth");
  return { sdk, auth: sdk.getAuth() };
}
let googleConfigured = false;
let interactiveAuth = false;
export async function prepareAuth() {
  await instance();
}
export async function googleLogin() {
  const {
    GoogleOneTapSignIn,
    isSuccessResponse,
    isNoSavedCredentialFoundResponse,
  } = await import("react-native-nitro-google-signin");
  if (!googleConfigured) {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId)
      throw new Error(
        "Google sign-in is awaiting this app’s OAuth configuration. Please use email/password for now.",
      );
    GoogleOneTapSignIn.configure({
      webClientId,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      autoSelectOnSignIn: false,
    });
    googleConfigured = true;
  }
  await GoogleOneTapSignIn.checkPlayServices();
  // A visible button opens the explicit account picker rather than silent login.
  const result = await GoogleOneTapSignIn.presentExplicitSignIn();
  if (!isSuccessResponse(result)) {
    if (isNoSavedCredentialFoundResponse(result))
      throw new Error(
        "Add a Google account on your device or use email/password.",
      );
    throw Object.assign(
      new Error("Google sign-in cancelled. You can try again."),
      { code: "auth/popup-closed-by-user" },
    );
  }
  if (!result.data.idToken)
    throw new Error("Google did not return a sign-in token. Please try again.");
  const { sdk, auth } = await instance();
  interactiveAuth = true;
  try {
    const credential = await sdk.signInWithCredential(
      auth,
      sdk.GoogleAuthProvider.credential(result.data.idToken),
    );
    return await sdk.getIdToken(credential.user, true);
  } finally {
    interactiveAuth = false;
  }
}
export async function emailRegister(
  email: string,
  password: string,
  name: string,
) {
  const { sdk, auth } = await instance();
  interactiveAuth = true;
  try {
    const { user } = await sdk.createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await sdk.updateProfile(user, { displayName: name });
    return await sdk.getIdToken(user, true);
  } finally {
    interactiveAuth = false;
  }
}
export async function emailLogin(email: string, password: string) {
  const { sdk, auth } = await instance();
  interactiveAuth = true;
  try {
    const { user } = await sdk.signInWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return await sdk.getIdToken(user, true);
  } finally {
    interactiveAuth = false;
  }
}
export async function token() {
  const { sdk, auth } = await instance();
  return auth.currentUser ? sdk.getIdToken(auth.currentUser) : "";
}
export async function logoutAuth() {
  const { sdk, auth } = await instance();
  await sdk.signOut(auth);
  if (googleConfigured) {
    const { GoogleOneTapSignIn } =
      await import("react-native-nitro-google-signin");
    await GoogleOneTapSignIn.signOut();
  }
}
export async function resetPassword(email: string) {
  const { sdk, auth } = await instance();
  await sdk.sendPasswordResetEmail(auth, email);
}
export async function subscribeAuth(callback: (signedIn: boolean) => void) {
  const { sdk, auth } = await instance();
  return sdk.onAuthStateChanged(auth, (u) => {
    if (!interactiveAuth) callback(!!u);
  });
}

export async function verificationEmail() {
  const { sdk, auth } = await instance();
  if (!auth.currentUser)
    throw new Error("Sign in again to send a verification link.");
  if (!auth.currentUser.emailVerified)
    await sdk.sendEmailVerification(auth.currentUser);
}
export async function appleLogin() {
  const Apple = await import("expo-apple-authentication"),
    Crypto = await import("expo-crypto");
  const bytes = await Crypto.getRandomBytesAsync(32),
    nonce = Array.from(bytes)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce,
  );
  const result = await Apple.signInAsync({
    nonce: hash,
    requestedScopes: [
      Apple.AppleAuthenticationScope.EMAIL,
      Apple.AppleAuthenticationScope.FULL_NAME,
    ],
  });
  if (!result.identityToken)
    throw new Error(
      "Apple did not return an identity token. Please try again.",
    );
  const { sdk, auth } = await instance();
  interactiveAuth = true;
  try {
    const { user } = await sdk.signInWithCredential(
      auth,
      sdk.AppleAuthProvider.credential(
        result.identityToken,
        nonce,
        result.fullName || undefined,
      ),
    );
    if (result.fullName && !user.displayName)
      await sdk.updateProfile(user, {
        displayName: Apple.formatFullName(result.fullName),
      });
    return await sdk.getIdToken(user, true);
  } finally {
    interactiveAuth = false;
  }
}

export async function prepareAccountDeletion(): Promise<string> {
  const { sdk, auth } = await instance();
  if (!auth.currentUser?.providerData.some((p) => p.providerId === "apple.com"))
    return "";
  const Apple = await import("expo-apple-authentication"),
    Crypto = await import("expo-crypto");
  const nonce = Array.from(await Crypto.getRandomBytesAsync(32))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  const result = await Apple.signInAsync({
    nonce: await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      nonce,
    ),
    requestedScopes: [],
  });
  if (!result.identityToken || !result.authorizationCode)
    throw new Error("Confirm Apple sign-in before deleting your account.");
  interactiveAuth = true;
  try {
    const { user } = await sdk.reauthenticateWithCredential(
      auth.currentUser,
      sdk.AppleAuthProvider.credential(result.identityToken, nonce),
    );
    await sdk.revokeToken(auth, result.authorizationCode);
    return await sdk.getIdToken(user, true);
  } finally {
    interactiveAuth = false;
  }
}

import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
} from "firebase/auth";
let initialized: Promise<ReturnType<typeof getAuth>> | undefined;
async function instance() {
  if (!initialized)
    initialized = (async () => {
      const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        authDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
      if (!projectId || !apiKey || !authDomain)
        throw new Error("Firebase web configuration is missing.");
      const app =
        getApps()[0] ||
        initializeApp({
          projectId,
          apiKey,
          authDomain,
          appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
        });
      const auth = getAuth(app);
      // The API restores its HttpOnly session cookie; browser tokens stay in memory.
      await setPersistence(auth, inMemoryPersistence);
      return auth;
    })();
  return initialized;
}
export async function prepareAuth() {
  await instance();
}
export async function googleLogin() {
  const auth = await instance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return (await signInWithPopup(auth, provider)).user.getIdToken(true);
}
export async function emailRegister(
  email: string,
  password: string,
  name: string,
) {
  const auth = await instance();
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName: name });
  return user.getIdToken(true);
}
export async function emailLogin(email: string, password: string) {
  return (
    await signInWithEmailAndPassword(await instance(), email, password)
  ).user.getIdToken(true);
}
export async function token() {
  return (await instance()).currentUser?.getIdToken() || "";
}
export async function logoutAuth() {
  if (initialized) await signOut(await initialized);
}
export async function resetPassword(email: string) {
  await sendPasswordResetEmail(await instance(), email);
}
export async function subscribeAuth(callback: (signedIn: boolean) => void) {
  return onAuthStateChanged(await instance(), (u) => callback(!!u));
}

export async function verificationEmail() {
  const user = (await instance()).currentUser;
  if (!user)
    throw new Error("Sign in with email again to send a verification link.");
  if (!user.emailVerified) await sendEmailVerification(user);
}
export async function appleLogin(): Promise<string> {
  throw new Error("Apple sign-in is available in the iOS app.");
}

export async function prepareAccountDeletion(): Promise<string> {
  return "";
}

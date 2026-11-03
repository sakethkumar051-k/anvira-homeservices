import { isRunningInExpoGo } from "expo";
import * as deviceAuth from "./auth-device";
import * as expoGoAuth from "./auth-expo-go";

// Native SDK imports inside deviceAuth are deferred until its functions run.
// Installed builds retain native authentication; Expo Go uses Firebase JS.
export const {
  prepareAuth,
  googleLogin,
  emailRegister,
  emailLogin,
  token,
  logoutAuth,
  resetPassword,
  subscribeAuth,
  verificationEmail,
  appleLogin,
  prepareAccountDeletion,
} = isRunningInExpoGo() ? expoGoAuth : deviceAuth;

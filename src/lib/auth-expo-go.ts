// Expo Go cannot load the installed app's native Firebase/Google modules.
// This adapter uses the same Firebase project and backend authorization.
import * as jsAuth from "./auth.web";
export {
  prepareAuth,
  token,
  logoutAuth,
  resetPassword,
  verificationEmail,
  prepareAccountDeletion,
} from "./auth.web";

let interactive = 0;
export async function emailLogin(email: string, password: string) {
  interactive++;
  try {
    return await jsAuth.emailLogin(email, password);
  } finally {
    interactive--;
  }
}
export async function emailRegister(
  email: string,
  password: string,
  name: string,
) {
  interactive++;
  try {
    return await jsAuth.emailRegister(email, password, name);
  } finally {
    interactive--;
  }
}
export async function subscribeAuth(callback: (signedIn: boolean) => void) {
  return jsAuth.subscribeAuth((signedIn) => {
    if (!interactive) callback(signedIn);
  });
}
export async function googleLogin(): Promise<string> {
  throw new Error(
    "Google sign-in requires the installed ANVIRA app. In Expo Go, use email/password.",
  );
}
export async function appleLogin(): Promise<string> {
  throw new Error(
    "Apple sign-in requires the installed ANVIRA app. In Expo Go, use email/password.",
  );
}

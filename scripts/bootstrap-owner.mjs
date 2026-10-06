import "dotenv/config";
import { firebaseServices } from "../server/lib/firebase.mjs";
import { config } from "../server/lib/config.mjs";
const uid = process.argv[2];
if (!uid)
  throw new Error(
    "Usage: APP_MODE=firebase node scripts/bootstrap-owner.mjs <verified-owner-uid>",
  );
const cfg = config();
if (!cfg.live)
  throw new Error("Owner bootstrap is only available in Firebase mode.");
const { auth, db } = await firebaseServices(cfg),
  user = await auth.getUser(uid);
if (!user.email || !user.emailVerified)
  throw new Error("The Owner must have a verified email address.");
await auth.setCustomUserClaims(uid, { ...user.customClaims, role: "owner" });
await db
  .collection("users")
  .doc(uid)
  .set(
    {
      id: uid,
      name: user.displayName || "ANVIRA Owner",
      email: user.email,
      role: "owner",
      active: true,
      createdAt: Date.now(),
    },
    { merge: true },
  );
await auth.revokeRefreshTokens(uid);
console.log("Owner role assigned. Sign in again to refresh claims.");

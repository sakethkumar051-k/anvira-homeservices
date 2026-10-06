import "dotenv/config";
import { firebaseServices } from "../server/lib/firebase.mjs";
import { config } from "../server/lib/config.mjs";
import { createFirestoreStore } from "../server/lib/store.mjs";

let db;
try {
  const cfg = config();
  if (!cfg.live || cfg.projectId !== "anvira-services") {
    throw Object.assign(new Error("Use the ANVIRA Firebase environment."), {
      code: "CONFIG_REQUIRED",
    });
  }
  const services = await firebaseServices(cfg);
  db = services.db;
  const identities = await services.auth.listUsers(1);
  await db.collection("settings").doc("company").get();
  const dashboard = process.argv.includes("--dashboard");
  if (dashboard) {
    const store = createFirestoreStore(db),
      uid = identities.users[0]?.uid || "setup-readiness",
      order = {
        order: [
          ["createdAt", "desc"],
          ["id", "desc"],
        ],
      };
    // These reads also require the indexes used after a real staff sign-in.
    for (const kind of ["bookings", "tickets", "audit", "payouts"])
      await store.list(kind, [], 1, order);
    await store.list("tickets", [["status", "==", "open"]], 1, order);
    await store.list(
      "tickets",
      [
        ["status", "==", "open"],
        ["priority", "==", "high"],
      ],
      1,
      order,
    );
    await store.list("notifications", [["userId", "==", uid]], 1, order);
    await store.list("users", [["role", "in", ["owner", "care"]]], 1, {
      order: [["id", "desc"]],
    });
  }
  console.log(
    JSON.stringify(
      {
        project: cfg.projectId,
        authentication: "connected",
        firestore: "connected",
        dashboardQueries: dashboard ? "ready" : "not checked",
        paymentCredentials: Boolean(
          cfg.razorpayKeyId && cfg.razorpayKeySecret && cfg.webhookSecret,
        ),
        writesPerformed: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const code = String(error.code || "CREDENTIALS_REQUIRED").replace(
    /[^a-zA-Z0-9_/-]/g,
    "",
  );
  console.error(
    `Firebase readiness not verified (${code}). Check credentials, project access and deployed index readiness.`,
  );
  process.exitCode = 1;
} finally {
  if (db) await db.terminate();
}

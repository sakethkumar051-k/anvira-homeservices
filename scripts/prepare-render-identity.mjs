import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";

// Prepare only this client's backend identity. Never print credentials or copy
// a developer's personal application-default refresh token to the hosting service.
const project = "anvira-services";
const accountId = "anvira-api-staging";
const email = `${accountId}@${project}.iam.gserviceaccount.com`;
const file = "credentials/render-firebase-service-account.json";
const roles = ["roles/datastore.user", "roles/firebaseauth.admin"];
if (process.argv[2] !== "--prepare")
  throw new Error(
    "Run with --prepare only when setting up the client's hosted API.",
  );
try {
  const client = await new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  }).getClient();
  const request = async (url, data) =>
    (
      await client.request({
        url,
        ...(data ? { method: "POST", data } : {}),
      })
    ).data;
  const billing = await request(
    `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,
  );
  if (billing.billingEnabled)
    throw Object.assign(
      new Error("Billing state changed; review before proceeding."),
      { code: "BILLING_CHANGED" },
    );
  const accountUrl = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
  try {
    await request(accountUrl);
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    await request(
      `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`,
      {
        accountId,
        serviceAccount: {
          displayName: "ANVIRA hosted staging API",
          description:
            "Firebase Auth and Firestore runtime only; no billing or project administration.",
        },
      },
    );
  }
  const policyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy = await request(policyUrl + ":getIamPolicy", {
    options: { requestedPolicyVersion: 3 },
  });
  let changed = false;
  policy.bindings ||= [];
  for (const role of roles) {
    let binding = policy.bindings.find((x) => x.role === role && !x.condition);
    if (!binding) {
      binding = { role, members: [] };
      policy.bindings.push(binding);
    }
    const member = "serviceAccount:" + email;
    if (!binding.members.includes(member)) {
      binding.members.push(member);
      changed = true;
    }
  }
  if (changed) await request(policyUrl + ":setIamPolicy", { policy });
  await mkdir("credentials", { recursive: true, mode: 0o700 });
  let credential;
  try {
    credential = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const key = await request(accountUrl + "/keys", {
      privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
    });
    credential = JSON.parse(
      Buffer.from(key.privateKeyData, "base64").toString("utf8"),
    );
    await writeFile(file, JSON.stringify(credential, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
  }
  if (
    credential.type !== "service_account" ||
    credential.project_id !== project ||
    credential.client_email !== email
  )
    throw Object.assign(new Error("Unexpected credential identity."), {
      code: "IDENTITY_MISMATCH",
    });
  await chmod(file, 0o600);
  console.log(
    JSON.stringify({
      project,
      serviceAccount: email,
      roles,
      privateCredentialFile: file,
      billingEnabled: false,
    }),
  );
} catch (error) {
  // Google error objects can contain bearer headers and key response data.
  console.error(
    JSON.stringify({
      setup: "failed",
      code:
        typeof error.code === "string" ? error.code : "HOST_IDENTITY_FAILED",
      httpStatus: error.response?.status || null,
    }),
  );
  process.exitCode = 1;
}

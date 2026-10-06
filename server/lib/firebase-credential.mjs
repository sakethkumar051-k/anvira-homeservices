import { createPrivateKey } from "node:crypto";

export function hostedFirebaseCredential(encoded, projectId) {
  const invalid = () => {
    throw new Error(
      "The hosted Firebase service credential is invalid or belongs to another project.",
    );
  };
  if (
    typeof encoded !== "string" ||
    encoded.length > 32768 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  )
    invalid();
  let credential;
  try {
    const raw = Buffer.from(encoded, "base64");
    if (raw.toString("base64") !== encoded) invalid();
    credential = JSON.parse(raw.toString("utf8"));
    if (
      credential.type !== "service_account" ||
      !projectId ||
      credential.project_id !== projectId ||
      typeof credential.client_email !== "string" ||
      !credential.client_email.endsWith(
        `@${projectId}.iam.gserviceaccount.com`,
      ) ||
      typeof credential.private_key !== "string" ||
      createPrivateKey(credential.private_key).asymmetricKeyType !== "rsa"
    )
      invalid();
  } catch {
    invalid();
  }
  return {
    projectId,
    clientEmail: credential.client_email,
    privateKey: credential.private_key,
  };
}

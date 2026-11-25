import { firestoreDocuments } from "./firestore-documents.mjs";
import { privateDocuments } from "./private-documents.mjs";
import { hostedFirebaseCredential } from "./firebase-credential.mjs";
export async function firebaseServices(cfg) {
  const { getApps, initializeApp, applicationDefault, cert } =
    await import("firebase-admin/app");
  const app =
    getApps()[0] ||
    initializeApp({
      credential: cfg.firebaseServiceAccountB64
        ? cert(
            hostedFirebaseCredential(
              cfg.firebaseServiceAccountB64,
              cfg.projectId,
            ),
          )
        : applicationDefault(),
      projectId: cfg.projectId,
      storageBucket: cfg.bucket,
    });
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  const db = getFirestore(app);
  return {
    auth: getAuth(app),
    db,
    bucket: cfg.privateDocumentDir
      ? privateDocuments({
          directory: cfg.privateDocumentDir,
          key: cfg.documentEncryptionKey,
          publicUrl: cfg.publicUrl,
          production: cfg.production,
          persistent: cfg.persistentDocuments,
        })
      : cfg.bucket
        ? getStorage(app).bucket()
        : firestoreDocuments(db, {
            publicUrl: cfg.publicUrl,
            signingSecret:
              cfg.firebaseServiceAccountB64 || cfg.internalJobSecret,
          }),
  };
}

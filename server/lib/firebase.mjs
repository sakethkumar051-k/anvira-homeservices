import { privateDocuments } from "./private-documents.mjs";
export async function firebaseServices(cfg) {
  const { getApps, initializeApp, applicationDefault } =
    await import("firebase-admin/app");
  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId: cfg.projectId,
      storageBucket: cfg.bucket,
    });
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getStorage } = await import("firebase-admin/storage");
  return {
    auth: getAuth(app),
    db: getFirestore(app),
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
        : null,
  };
}

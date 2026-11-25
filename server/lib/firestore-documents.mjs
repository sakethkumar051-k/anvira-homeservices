import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes,
} from "node:crypto";

// Private, durable onboarding files without a paid storage bucket. Firestore
// rules deny all client access; only the authenticated API issues 60-second links.
export function firestoreDocuments(db, { publicUrl, signingSecret }) {
  const key = createHash("sha256")
    .update(
      "anvira-document-links-v1:" +
        (signingSecret || randomBytes(32).toString("hex")),
    )
    .digest();
  const sign = (value) => createHmac("sha256", key).update(value).digest("hex");
  const root = (id) => db.collection("privateDocuments").doc(id);
  const chunkSize = 512 * 1024;
  const types = ["application/pdf", "image/jpeg", "image/png"];
  const missing = () =>
    Object.assign(new Error("Document is no longer available."), {
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
    });
  return {
    backend: "private-firestore",
    file(storagePath) {
      const id = createHash("sha256").update(storagePath).digest("hex"),
        ref = root(id);
      return {
        async save(buffer, options) {
          const contentType = options.metadata.contentType;
          if (
            !buffer.length ||
            buffer.length > 10 * 1024 * 1024 ||
            !types.includes(contentType)
          )
            throw new Error("Choose a PDF, JPG or PNG up to 10 MB.");
          const parts = Math.ceil(buffer.length / chunkSize);
          let written = 0;
          try {
            // Keep each commit well below Firestore's 10 MiB request limit.
            for (let start = 0; start < parts; start += 8) {
              const batch = db.batch(),
                end = Math.min(parts, start + 8);
              for (let i = start; i < end; i++)
                batch.create(ref.collection("chunks").doc(String(i)), {
                  bytes: buffer.subarray(i * chunkSize, (i + 1) * chunkSize),
                });
              await batch.commit();
              written = end;
            }
            // Publish metadata only after every private chunk is durable.
            await ref.create({
              parts,
              size: buffer.length,
              contentType,
              createdAt: Date.now(),
            });
          } catch (error) {
            if (written) {
              const cleanup = db.batch();
              for (let i = 0; i < written; i++)
                cleanup.delete(ref.collection("chunks").doc(String(i)));
              await cleanup.commit().catch(() => {});
            }
            throw error;
          }
        },
        async getSignedUrl({ expires }) {
          const value = id + "." + Math.min(expires, Date.now() + 60000);
          return [
            publicUrl +
              "/api/documents/download?token=" +
              value +
              "." +
              sign(value),
          ];
        },
        async delete({ ignoreNotFound } = {}) {
          const doc = await ref.get();
          if (!doc.exists) {
            if (ignoreNotFound) return;
            throw missing();
          }
          const parts = doc.data().parts;
          if (!Number.isInteger(parts) || parts < 1 || parts > 20)
            throw new Error("Invalid document metadata.");
          const batch = db.batch();
          for (let i = 0; i < parts; i++)
            batch.delete(ref.collection("chunks").doc(String(i)));
          batch.delete(ref);
          await batch.commit();
        },
      };
    },
    async download(token) {
      const match = /^([a-f0-9]{64})\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
      if (
        !match ||
        Number(match[2]) < Date.now() ||
        Number(match[2]) > Date.now() + 65000 ||
        !timingSafeEqual(
          Buffer.from(match[3], "hex"),
          Buffer.from(sign(match[1] + "." + match[2]), "hex"),
        )
      )
        throw Object.assign(new Error("Document link is invalid or expired."), {
          status: 403,
          code: "DOCUMENT_LINK_EXPIRED",
        });
      const ref = root(match[1]),
        doc = await ref.get();
      if (!doc.exists) throw missing();
      const { parts, size, contentType } = doc.data();
      if (
        !Number.isInteger(parts) ||
        parts < 1 ||
        parts > 20 ||
        size > 10 * 1024 * 1024 ||
        !types.includes(contentType)
      )
        throw new Error("Invalid document metadata.");
      const chunks = await db.getAll(
        ...Array.from({ length: parts }, (_, i) =>
          ref.collection("chunks").doc(String(i)),
        ),
      );
      const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
      const buffers = Array.from({ length: parts }, (_, i) => {
        const chunk = byId.get(String(i));
        if (!chunk?.exists || !Buffer.isBuffer(chunk.data().bytes))
          throw missing();
        return chunk.data().bytes;
      });
      const buffer = Buffer.concat(buffers);
      if (buffer.length !== size) throw missing();
      return { buffer, contentType };
    },
  };
}

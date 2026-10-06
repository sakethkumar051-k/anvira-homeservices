import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
// Portable encrypted storage for a standalone host with a persistent private volume.
// This adapter must be shared by every API instance and included in encrypted backups.
export function privateDocuments({
  directory,
  key,
  publicUrl,
  production,
  persistent,
}) {
  if (
    !path.isAbsolute(directory) ||
    !/^[A-Za-z0-9+/]{43}=$/.test(key || "") ||
    Buffer.from(key, "base64").length !== 32
  )
    throw new Error(
      "Private documents require an absolute directory and a 32-byte base64 DOCUMENT_ENCRYPTION_KEY.",
    );
  if (production && !persistent)
    throw new Error(
      "Confirm the private document volume is persistent before production.",
    );
  const secret = Buffer.from(key, "base64"),
    aad = Buffer.from("anvira-private-document-v1");
  const signature = (value) =>
    createHmac("sha256", secret)
      .update("download:" + value)
      .digest("hex");
  const filename = (id) => path.join(directory, id + ".enc");
  function validate(token) {
    const [id, expiry, sig, extra] = String(token).split(".");
    if (
      extra ||
      !/^[a-f0-9]{64}$/.test(id || "") ||
      !/^\d{13}$/.test(expiry || "") ||
      !/^[a-f0-9]{64}$/.test(sig || "") ||
      Number(expiry) < Date.now() ||
      Number(expiry) > Date.now() + 65000 ||
      !timingSafeEqual(
        Buffer.from(sig, "hex"),
        Buffer.from(signature(id + "." + expiry), "hex"),
      )
    )
      throw Object.assign(new Error("Document link is invalid or expired."), {
        status: 403,
        code: "DOCUMENT_LINK_EXPIRED",
      });
    return id;
  }
  return {
    backend: "encrypted-volume",
    file(storagePath) {
      const id = createHash("sha256").update(storagePath).digest("hex");
      return {
        async save(buffer, options) {
          if (buffer.length > 10 * 1024 * 1024)
            throw new Error("Document exceeds storage limit.");
          await mkdir(directory, { recursive: true, mode: 0o700 });
          const iv = randomBytes(12),
            cipher = createCipheriv("aes-256-gcm", secret, iv);
          cipher.setAAD(aad);
          const metadata = Buffer.from(
            JSON.stringify({ contentType: options.metadata.contentType }) +
              "\n",
          );
          const encrypted = Buffer.concat([
            cipher.update(Buffer.concat([metadata, buffer])),
            cipher.final(),
          ]);
          await writeFile(
            filename(id),
            Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
            { mode: 0o600, flag: "wx" },
          );
        },
        async getSignedUrl({ expires }) {
          const expiry = Math.min(expires, Date.now() + 60000),
            value = id + "." + expiry;
          return [
            publicUrl +
              "/api/documents/download?token=" +
              value +
              "." +
              signature(value),
          ];
        },
        async delete({ ignoreNotFound } = {}) {
          try {
            await unlink(filename(id));
          } catch (e) {
            if (!(ignoreNotFound && e.code === "ENOENT")) throw e;
          }
        },
      };
    },
    async download(token) {
      const id = validate(token);
      let raw;
      try {
        raw = await readFile(filename(id));
      } catch (error) {
        if (error.code === "ENOENT")
          throw Object.assign(new Error("Document is no longer available."), {
            status: 404,
            code: "DOCUMENT_NOT_FOUND",
          });
        throw error;
      }
      if (raw.length < 29 || raw.length > 10 * 1024 * 1024 + 512)
        throw new Error("Invalid encrypted document.");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        secret,
        raw.subarray(0, 12),
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(raw.subarray(12, 28));
      const plain = Buffer.concat([
          decipher.update(raw.subarray(28)),
          decipher.final(),
        ]),
        cut = plain.indexOf(10),
        metadata = JSON.parse(plain.subarray(0, cut).toString());
      if (
        !["application/pdf", "image/jpeg", "image/png"].includes(
          metadata.contentType,
        )
      )
        throw new Error("Invalid document type.");
      return {
        buffer: plain.subarray(cut + 1),
        contentType: metadata.contentType,
      };
    },
  };
}

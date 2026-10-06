import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
const prefix = "anvira-draft-";
const indexKey = "anvira-draft-index";
let tail: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = tail.then(fn, fn);
  tail = result.catch(() => {});
  return result;
};
async function readIndex(): Promise<string[]> {
  const saved = JSON.parse(
    (await SecureStore.getItemAsync(indexKey)) || "null",
  );
  if (Array.isArray(saved)) return saved;
  if (!saved || saved.count > 100) return [];
  const parts = await Promise.all(
    Array.from({ length: saved.count }, (_, i) =>
      SecureStore.getItemAsync(indexKey + "-" + i),
    ),
  );
  return JSON.parse(parts.join(""));
}
async function writeIndex(keys: string[]) {
  const raw = JSON.stringify(keys),
    count = Math.ceil(raw.length / 400);
  for (let i = 0; i < count; i++)
    await SecureStore.setItemAsync(
      indexKey + "-" + i,
      raw.slice(i * 400, (i + 1) * 400),
    );
  await SecureStore.setItemAsync(indexKey, JSON.stringify({ count }));
}
const keyFor = async (user: string, key: string) =>
  prefix +
  (await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    user + ":" + key,
  ));
export async function loadDraft<T>(
  user: string,
  key: string,
): Promise<T | null> {
  return serial(async () => {
    const id = await keyFor(user, key);
    try {
      let raw: string | null;
      if (Platform.OS === "web") raw = sessionStorage.getItem(id);
      else {
        const manifest = JSON.parse(
          (await SecureStore.getItemAsync(id)) || "null",
        );
        if (!manifest || manifest.count > 100) return null;
        raw = (
          await Promise.all(
            Array.from({ length: manifest.count }, (_, i) =>
              SecureStore.getItemAsync(id + "-" + manifest.version + "-" + i),
            ),
          )
        ).join("");
      }
      const saved = JSON.parse(raw || "null");
      return saved?.user === user && saved.at > Date.now() - 7 * 86400000
        ? saved.data
        : null;
    } catch {
      return null;
    }
  });
}
export async function saveDraft(user: string, key: string, data: unknown) {
  return serial(async () => {
    const id = await keyFor(user, key),
      raw = JSON.stringify({ user, at: Date.now(), data });
    if (raw.length > 30000)
      throw new Error("This draft is too large to save on your device.");
    if (Platform.OS === "web") {
      sessionStorage.setItem(id, raw);
      return;
    }
    const old = JSON.parse((await SecureStore.getItemAsync(id)) || "null"),
      version = Date.now().toString(36);
    const chars = Array.from(raw),
      count = Math.ceil(chars.length / 400);
    const index: string[] = await readIndex();
    // Register before writing so logout can clean partially written drafts as well.
    const keys = Array.from(
      { length: count },
      (_, i) => id + "-" + version + "-" + i,
    );
    const nextIndex = [...new Set([...index, id, ...keys])];
    // Index is also chunk-free and bounded; expire old drafts before many are accumulated.
    if (nextIndex.join("").length > 12000)
      throw new Error("Clear saved drafts before saving more.");
    await writeIndex(nextIndex);
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        keys[i],
        chars.slice(i * 400, (i + 1) * 400).join(""),
      );
    await SecureStore.setItemAsync(id, JSON.stringify({ count, version }));
    if (old)
      for (let i = 0; i < old.count; i++)
        await SecureStore.deleteItemAsync(id + "-" + old.version + "-" + i);
    const retained = nextIndex.filter(
      (k) => !old || !k.startsWith(id + "-" + old.version + "-"),
    );
    await writeIndex(retained);
  });
}
export async function removeDraft(user: string, key: string) {
  return serial(async () => {
    const id = await keyFor(user, key);
    if (Platform.OS === "web") {
      sessionStorage.removeItem(id);
      return;
    }
    const index: string[] = await readIndex();
    for (const k of index.filter((k) => k === id || k.startsWith(id + "-")))
      await SecureStore.deleteItemAsync(k);
    await writeIndex(index.filter((k) => k !== id && !k.startsWith(id + "-")));
  });
}
export async function clearDrafts() {
  return serial(async () => {
    if (Platform.OS === "web") {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    } else {
      const index: string[] = await readIndex();
      for (const key of index) await SecureStore.deleteItemAsync(key);
      for (let i = 0; i < 100; i++)
        await SecureStore.deleteItemAsync(indexKey + "-" + i);
      await SecureStore.deleteItemAsync(indexKey);
    }
  });
}

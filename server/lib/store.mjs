import { clean } from "./errors.mjs";
const matches = (value, filters) =>
  filters.every(([key, op, expected]) =>
    op === "=="
      ? value[key] === expected
      : op === "in"
        ? expected.includes(value[key])
        : op === "<="
          ? value[key] <= expected
          : op === ">="
            ? value[key] >= expected
            : op === "<"
              ? value[key] < expected
              : op === ">"
                ? value[key] > expected
                : false,
  );
const ordered = (rows, options = {}) => {
  if (options.order)
    rows.sort((a, b) => {
      for (const [field, direction] of options.order) {
        const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
        if (cmp) return direction === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  if (options.cursor)
    rows = rows.filter((x) => {
      for (const [i, [field, direction]] of (options.order || []).entries()) {
        if (x[field] === options.cursor[i]) continue;
        return direction === "desc"
          ? x[field] < options.cursor[i]
          : x[field] > options.cursor[i];
      }
      return false;
    });
  return rows;
};
class Unit {
  constructor(reader) {
    this.reader = reader;
    this.pending = new Map();
  }
  async get(kind, id) {
    const key = kind + "/" + id;
    if (this.pending.has(key)) return this.pending.get(key)?.value || null;
    return this.reader.get(kind, id);
  }
  async list(kind, filters = [], limit = 1000, options = {}) {
    const values = new Map(
      (await this.reader.list(kind, filters, limit, options)).map((x) => [
        x.id,
        x,
      ]),
    );
    for (const item of this.pending.values())
      if (item.kind === kind) {
        if (item.value && matches(item.value, filters))
          values.set(item.id, item.value);
        else values.delete(item.id);
      }
    return ordered([...values.values()], options).slice(0, limit);
  }
  put(kind, value) {
    const v = clean(value);
    this.pending.set(kind + "/" + v.id, { kind, id: v.id, value: v });
  }
  remove(kind, id) {
    this.pending.set(kind + "/" + id, { kind, id, value: null });
  }
}
export async function createSQLiteStore(dbPath) {
  const { DatabaseSync } = await import("node:sqlite");
  const db = new DatabaseSync(dbPath);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (kind TEXT,id TEXT,data TEXT,PRIMARY KEY(kind,id));",
  );
  const reader = {
    async get(kind, id) {
      const r = db
        .prepare("SELECT data FROM records WHERE kind=? AND id=?")
        .get(kind, id);
      return r ? JSON.parse(r.data) : null;
    },
    async list(kind, filters = [], limit = 1000, options = {}) {
      return ordered(
        db
          .prepare("SELECT data FROM records WHERE kind=? ORDER BY rowid")
          .all(kind)
          .map((r) => JSON.parse(r.data))
          .filter((x) => matches(x, filters)),
        options,
      ).slice(0, limit);
    },
  };
  let tail = Promise.resolve();
  return {
    ...reader,
    async aggregate(kind, filters = [], sums = []) {
      const rows = await reader.list(kind, filters, Number.MAX_SAFE_INTEGER);
      return {
        count: rows.length,
        ...Object.fromEntries(
          sums.map((field) => [
            field,
            rows.reduce(
              (sum, row) =>
                sum + (typeof row[field] === "number" ? row[field] : 0),
              0,
            ),
          ]),
        ),
      };
    },
    async transaction(fn) {
      let release;
      const previous = tail;
      tail = new Promise((r) => (release = r));
      await previous;
      let begun = false;
      try {
        db.exec("BEGIN IMMEDIATE");
        begun = true;
        const tx = new Unit(reader);
        const value = await fn(tx);
        for (const { kind, id, value: v } of tx.pending.values()) {
          if (v)
            db.prepare("INSERT OR REPLACE INTO records VALUES (?,?,?)").run(
              kind,
              id,
              JSON.stringify(v),
            );
          else
            db.prepare("DELETE FROM records WHERE kind=? AND id=?").run(
              kind,
              id,
            );
        }
        db.exec("COMMIT");
        return value;
      } catch (e) {
        if (begun) db.exec("ROLLBACK");
        throw e;
      } finally {
        release();
      }
    },
    close() {
      db.close();
    },
  };
}
export function createFirestoreStore(db) {
  const collection = (kind) => db.collection(kind);
  const query = (kind, filters, limit, options = {}) => {
    let q = collection(kind);
    for (const [field, op, value] of filters) q = q.where(field, op, value);
    for (const [field, direction] of options.order || [])
      q = q.orderBy(field, direction);
    if (options.cursor) q = q.startAfter(...options.cursor);
    return q.limit(Math.min(limit, 1000));
  };
  const data = (snapshot) =>
    snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
  return {
    async get(kind, id) {
      return data(await collection(kind).doc(id).get());
    },
    async list(kind, filters = [], limit = 1000, options = {}) {
      return (await query(kind, filters, limit, options).get()).docs.map(data);
    },
    async aggregate(kind, filters = [], sums = []) {
      const { AggregateField } = await import("firebase-admin/firestore");
      let q = collection(kind);
      for (const [field, op, value] of filters) q = q.where(field, op, value);
      return (
        await q
          .aggregate({
            count: AggregateField.count(),
            ...Object.fromEntries(
              sums.map((field) => [field, AggregateField.sum(field)]),
            ),
          })
          .get()
      ).data();
    },
    async transaction(fn) {
      return db.runTransaction(
        async (native) => {
          const reader = {
            async get(kind, id) {
              return data(await native.get(collection(kind).doc(id)));
            },
            async list(kind, filters = [], limit = 1000, options = {}) {
              return (
                await native.get(query(kind, filters, limit, options))
              ).docs.map(data);
            },
          };
          const tx = new Unit(reader);
          const value = await fn(tx);
          if (tx.pending.size > 450)
            throw Object.assign(
              new Error(
                "This operation has too many records. Contact support for an assisted request.",
              ),
              { status: 409, code: "BATCH_TOO_LARGE" },
            );
          for (const { kind, id, value: v } of tx.pending.values()) {
            const ref = collection(kind).doc(id);
            if (v) native.set(ref, v);
            else native.delete(ref);
          }
          return value;
        },
        { maxAttempts: 5 },
      );
    },
  };
}

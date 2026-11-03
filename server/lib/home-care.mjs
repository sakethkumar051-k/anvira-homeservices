import { createHash } from "node:crypto";
import { z } from "zod";
import { assertRole, fail } from "./errors.mjs";

export const homeCareCollections = [
  "homeCareFavorites",
  "homeCareReminders",
  "homeCareAssets",
];
const LIMIT = 200;
const DAY = 86400000;
const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Enter a real date as YYYY-MM-DD.");
const reminderSchema = z
  .object({
    serviceId: idSchema,
    addressId: idSchema,
    intervalDays: z.number().int().min(7).max(365),
    dueAt: z.number().int().positive(),
  })
  .strict();
const reminderPatch = z
  .object({
    intervalDays: z.number().int().min(7).max(365).optional(),
    dueAt: z.number().int().positive().optional(),
    status: z.enum(["active", "paused"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Choose a change to save.");
const assetSchema = z
  .object({
    addressId: idSchema,
    label: z.string().trim().min(2).max(80),
    category: z.string().trim().min(2).max(60),
    model: z.string().trim().max(100).optional(),
    installedAt: dateSchema.optional(),
    warrantyUntil: dateSchema.optional(),
  })
  .strict();
const assetPatch = assetSchema.partial().extend({
  model: z.string().trim().max(100).nullable().optional(),
  installedAt: dateSchema.nullable().optional(),
  warrantyUntil: dateSchema.nullable().optional(),
});
const hash = (value) => createHash("sha256").update(value).digest("hex");
const ownerFilter = (userId) => [["customerId", "==", userId]];
const available = (service, live = true) =>
  !!(service?.active && (!live || !service.sample || service.sampleReviewed));
const recordId = (userId, kind, key) =>
  hash(JSON.stringify([userId, kind, idSchema.parse(key)]));
const publicRecord = ({ creationHash, ...record }) => record;
async function owned(reader, kind, id, userId) {
  const record = await reader.get(kind, idSchema.parse(id));
  if (!record || record.customerId !== userId)
    fail(404, "Home-care record not found.", "HOME_CARE_NOT_FOUND");
  return record;
}
async function address(reader, id, userId) {
  const value = await reader.get("addresses", idSchema.parse(id));
  if (!value || value.customerId !== userId)
    fail(404, "Choose one of your saved addresses.", "ADDRESS_NOT_FOUND");
  return value;
}
async function approvedService(reader, id, live) {
  const value = await reader.get("services", idSchema.parse(id));
  if (!available(value, live))
    fail(400, "Choose an available service.", "SERVICE_UNAVAILABLE");
  return value;
}
async function privateRecords(reader, userId) {
  return Promise.all(
    homeCareCollections.map((kind) =>
      reader.list(kind, ownerFilter(userId), LIMIT + 1),
    ),
  );
}
async function ensureCapacity(tx, userId) {
  const rows = await privateRecords(tx, userId);
  if (rows.reduce((sum, records) => sum + records.length, 0) >= LIMIT)
    fail(
      409,
      "You can save up to 200 home-care records. Remove an old record first.",
      "HOME_CARE_LIMIT",
    );
}
function future(value, now) {
  if (value <= now || value > now + 366 * DAY)
    fail(
      400,
      "Choose a future reminder within the next year.",
      "INVALID_REMINDER_DATE",
    );
}
function validateAsset(value, now) {
  if (
    value.installedAt &&
    value.installedAt > new Date(now).toISOString().slice(0, 10)
  )
    fail(
      400,
      "An installation date cannot be in the future.",
      "INVALID_ASSET_DATE",
    );
  if (
    value.installedAt &&
    value.warrantyUntil &&
    value.warrantyUntil < value.installedAt
  )
    fail(
      400,
      "Warranty end cannot be before installation.",
      "INVALID_ASSET_DATE",
    );
}

export function homeCare(store, business, cfg = {}, clock = Date.now) {
  function customer(user) {
    assertRole(user, "customer");
  }
  async function read(user) {
    customer(user);
    const [privateRows, bookings, addresses] = await Promise.all([
      privateRecords(store, user.id),
      store.list(
        "bookings",
        [...ownerFilter(user.id), ["status", "==", "completed"]],
        LIMIT + 1,
        {
          order: [
            ["completedAt", "desc"],
            ["id", "desc"],
          ],
        },
      ),
      store.list("addresses", ownerFilter(user.id), 20),
    ]);
    const groups = new Map();
    for (const booking of bookings.slice(0, LIMIT)) {
      const location = booking.address || {
        line: "Address not recorded",
        pin: "",
      };
      const key = hash(
        JSON.stringify([location.line.trim().toLowerCase(), location.pin]),
      );
      if (!groups.has(key))
        groups.set(key, {
          id: key,
          address: { line: location.line, pin: location.pin },
          addressId: addresses.find(
            (a) =>
              a.line.trim().toLowerCase() ===
                location.line.trim().toLowerCase() && a.pin === location.pin,
          )?.id,
          bookings: [],
        });
      groups.get(key).bookings.push({
        id: booking.id,
        serviceId: booking.serviceId,
        serviceName: booking.serviceName,
        completedAt: booking.completedAt,
        slot: booking.slot,
      });
    }
    return {
      favorites: privateRows[0].slice(0, LIMIT).map((x) => x.serviceId),
      reminders: privateRows[1].slice(0, LIMIT).map(publicRecord),
      assets: privateRows[2].slice(0, LIMIT).map(publicRecord),
      history: {
        groups: [...groups.values()],
        hasMore: bookings.length > LIMIT,
        limit: LIMIT,
      },
    };
  }
  async function favorite(user, serviceId, saved) {
    customer(user);
    const id = recordId(user.id, "favorite", serviceId);
    await store.transaction(async (tx) => {
      if (!saved) {
        tx.remove("homeCareFavorites", id);
        return;
      }
      await approvedService(tx, serviceId, cfg.live);
      if (await tx.get("homeCareFavorites", id)) return;
      await ensureCapacity(tx, user.id);
      tx.put("homeCareFavorites", {
        id,
        customerId: user.id,
        serviceId,
        createdAt: clock(),
      });
    });
    return { saved };
  }
  async function createReminder(user, key, input) {
    customer(user);
    const value = reminderSchema.parse(input),
      id = recordId(user.id, "reminder", key),
      creationHash = hash(JSON.stringify(value));
    return store.transaction(async (tx) => {
      const existing = await tx.get("homeCareReminders", id);
      if (existing) {
        if (existing.creationHash !== creationHash)
          fail(
            409,
            "This reminder request has changed.",
            "IDEMPOTENCY_CONFLICT",
          );
        return publicRecord(existing);
      }
      future(value.dueAt, clock());
      const service = await approvedService(tx, value.serviceId, cfg.live);
      await address(tx, value.addressId, user.id);
      const reminders = await tx.list(
        "homeCareReminders",
        ownerFilter(user.id),
        LIMIT + 1,
      );
      if (
        reminders.some(
          (r) =>
            r.serviceId === value.serviceId && r.addressId === value.addressId,
        )
      )
        fail(
          409,
          "A reminder already exists for this service and address. Edit it instead.",
          "REMINDER_EXISTS",
        );
      await ensureCapacity(tx, user.id);
      const record = {
        ...value,
        id,
        customerId: user.id,
        serviceName: service.name,
        status: "active",
        requiresReviewedService: cfg.live !== false,
        creationHash,
        createdAt: clock(),
        updatedAt: clock(),
      };
      tx.put("homeCareReminders", record);
      return publicRecord(record);
    });
  }
  async function patchReminder(user, id, input) {
    customer(user);
    const changes = reminderPatch.parse(input);
    return store.transaction(async (tx) => {
      const previous = await owned(tx, "homeCareReminders", id, user.id);
      const next = { ...previous, ...changes, updatedAt: clock() };
      if (changes.dueAt !== undefined) future(changes.dueAt, clock());
      if (next.status === "active") {
        await address(tx, next.addressId, user.id);
        const service = await approvedService(tx, next.serviceId, cfg.live);
        next.serviceName = service.name;
        if (next.dueAt <= clock())
          next.dueAt = clock() + next.intervalDays * DAY;
        delete next.pauseReason;
      }
      tx.put("homeCareReminders", next);
      return publicRecord(next);
    });
  }
  async function createAsset(user, key, input) {
    customer(user);
    const value = assetSchema.parse(input),
      id = recordId(user.id, "asset", key),
      creationHash = hash(JSON.stringify(value));
    return store.transaction(async (tx) => {
      const existing = await tx.get("homeCareAssets", id);
      if (existing) {
        if (existing.creationHash !== creationHash)
          fail(409, "This asset request has changed.", "IDEMPOTENCY_CONFLICT");
        return publicRecord(existing);
      }
      validateAsset(value, clock());
      await address(tx, value.addressId, user.id);
      await ensureCapacity(tx, user.id);
      const record = {
        ...value,
        id,
        customerId: user.id,
        creationHash,
        createdAt: clock(),
        updatedAt: clock(),
      };
      tx.put("homeCareAssets", record);
      return publicRecord(record);
    });
  }
  async function patchAsset(user, id, input) {
    customer(user);
    const changes = assetPatch.parse(input);
    if (!Object.keys(changes).length) fail(400, "Choose a change to save.");
    return store.transaction(async (tx) => {
      const previous = await owned(tx, "homeCareAssets", id, user.id),
        next = { ...previous, ...changes, updatedAt: clock() };
      for (const field of ["model", "installedAt", "warrantyUntil"])
        if (next[field] === null) delete next[field];
      validateAsset(next, clock());
      await address(tx, next.addressId, user.id);
      tx.put("homeCareAssets", next);
      return publicRecord(next);
    });
  }
  async function remove(user, kind, id) {
    customer(user);
    await store.transaction(async (tx) => {
      await owned(tx, kind, id, user.id);
      tx.remove(kind, id);
    });
    return { removed: true };
  }
  return {
    read,
    favorite,
    createReminder,
    patchReminder,
    createAsset,
    patchAsset,
    removeReminder: (user, id) => remove(user, "homeCareReminders", id),
    removeAsset: (user, id) => remove(user, "homeCareAssets", id),
  };
}

export async function runHomeCareReminders(store, business, now = Date.now()) {
  const due = await store.list(
    "homeCareReminders",
    [
      ["status", "==", "active"],
      ["dueAt", "<=", now],
    ],
    100,
  );
  let sent = 0,
    paused = 0;
  for (const row of due) {
    const result = await store.transaction(async (tx) => {
      const current = await tx.get("homeCareReminders", row.id);
      if (!current || current.status !== "active" || current.dueAt > now)
        return "skipped";
      const [user, service, location] = await Promise.all([
        tx.get("users", current.customerId),
        tx.get("services", current.serviceId),
        tx.get("addresses", current.addressId),
      ]);
      if (
        !user ||
        user.active === false ||
        !available(service, current.requiresReviewedService !== false) ||
        !location ||
        location.customerId !== current.customerId ||
        !Number.isInteger(current.intervalDays) ||
        current.intervalDays < 7 ||
        current.intervalDays > 365
      ) {
        tx.put("homeCareReminders", {
          ...current,
          status: "paused",
          pauseReason:
            "The service, address or account is unavailable. Review before resuming.",
          updatedAt: now,
        });
        return "paused";
      }
      business.notify(
        tx,
        current.customerId,
        "Time to plan your home care",
        `${service.name} is due for review. Open Home care to choose a visit. This reminder does not book or charge you.`,
      );
      tx.put("homeCareReminders", {
        ...current,
        lastNotifiedAt: now,
        dueAt: now + current.intervalDays * DAY,
        updatedAt: now,
      });
      return "sent";
    });
    if (result === "sent") sent++;
    if (result === "paused") paused++;
  }
  return { sent, paused };
}

export async function cleanupHomeCare(tx, userId) {
  const rows = await privateRecords(tx, userId);
  if (rows.reduce((sum, records) => sum + records.length, 0) > LIMIT)
    fail(
      409,
      "Contact support to delete a high-volume home-care passport.",
      "HOME_CARE_CLEANUP_LIMIT",
    );
  rows.forEach((records, index) =>
    records.forEach((record) =>
      tx.remove(homeCareCollections[index], record.id),
    ),
  );
}

import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { fail } from "./errors.mjs";
import { isReviewRecord, paymentEnvironment } from "./payment-environment.mjs";

export const payoutScheduleSchema = z
  .object({
    frequency: z.enum(["paused", "daily", "weekly"]),
    weekday: z.number().int().min(0).max(6),
    hour: z.number().int().min(0).max(23),
    minimum: z.number().int().min(100).max(100000),
    reserve: z.number().int().min(0).max(100000),
    maximum: z.number().int().min(100).max(100000),
    batchLimit: z.number().int().min(100).max(1000000),
    approvalRequired: z.boolean(),
  })
  .refine(
    (v) => v.maximum >= v.minimum && v.batchLimit >= v.maximum,
    "Maximum must cover the minimum, and the batch limit must cover the maximum.",
  );
export const defaultPayoutSchedule = {
  frequency: "paused",
  weekday: 1,
  hour: 18,
  minimum: 100,
  reserve: 0,
  maximum: 10000,
  batchLimit: 100000,
  approvalRequired: true,
};
const hash = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 36);
const actor = { id: "payout-scheduler", role: "system" };
const normalName = (name) =>
  String(name || "")
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function payoutWindow(schedule, now = Date.now()) {
  const local = new Date(now + 330 * 60000);
  let due =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      schedule.hour,
    ) -
    330 * 60000;
  if (schedule.frequency === "weekly")
    due -= ((local.getUTCDay() - schedule.weekday + 7) % 7) * 86400000;
  const interval = (schedule.frequency === "weekly" ? 7 : 1) * 86400000;
  if (due > now) due -= interval;
  return {
    due,
    next: due + interval,
    date: new Date(due + 330 * 60000).toISOString().slice(0, 10),
  };
}
export function payoutOperations(store, business, gateway, cfg) {
  const ready = () =>
    cfg.paymentMode === "demo" ||
    !!(
      cfg.payoutsEnabled &&
      cfg.payoutAccount &&
      (cfg.razorpayXKeyId || cfg.razorpayKeyId) &&
      (cfg.razorpayXKeySecret || cfg.razorpayKeySecret) &&
      cfg.payoutWebhookSecret
    );
  const settings = async (reader = store) => ({
    ...defaultPayoutSchedule,
    ...(await reader.get("settings", "payoutSchedule")),
  });
  async function saveSchedule(value, user) {
    if (value.frequency !== "paused" && !ready())
      fail(
        503,
        "Configure RazorpayX payouts and webhooks before enabling a schedule. You can still preview the setup.",
      );
    await store.transaction(async (tx) => {
      const previous = await settings(tx);
      tx.put("settings", {
        ...value,
        id: "payoutSchedule",
        enabledAt:
          previous.frequency === value.frequency && previous.enabledAt
            ? previous.enabledAt
            : Date.now(),
        updatedAt: Date.now(),
        updatedBy: user.id,
      });
      business.audit(tx, user, "payout_schedule_changed", "payoutSchedule", {
        frequency: value.frequency,
        approvalRequired: value.approvalRequired,
      });
    });
  }
  function eligibility(p, wallet, user, schedule, now) {
    let reason = "";
    const amount = Math.min(
      schedule.maximum,
      Math.max(0, (wallet?.available || 0) - schedule.reserve),
    );
    if (isReviewRecord(p))
      reason = "Review-only professional cannot receive payouts";
    else if (!p.approved || p.type !== "Partner")
      reason = "Approved partner required";
    else if (user?.active === false) reason = "Account disabled";
    else if (p.bankUpdateLease) reason = "Bank account update in progress";
    else if (!p.fundAccountId || p.bankVerification !== "verified")
      reason = "Verified bank account required";
    else if ((p.bankEligibleAt || 0) > now)
      reason = "Bank change cooling period";
    else if (amount < schedule.minimum) reason = "Below minimum after reserve";
    return {
      id: p.id,
      name: p.name,
      available: wallet?.available || 0,
      amount: reason ? 0 : amount,
      reason,
      bankLast4: p.bankLast4 || "",
    };
  }
  async function preview(now = Date.now()) {
    const schedule = await settings(),
      professionals = await store.list("professionals", [], 500);
    const rows = [];
    for (const p of professionals.filter((p) => p.type === "Partner"))
      rows.push(
        eligibility(
          p,
          await store.get("wallets", p.id),
          await store.get("users", p.id),
          schedule,
          now,
        ),
      );
    let total = 0;
    for (const row of rows.sort((a, b) => a.id.localeCompare(b.id))) {
      if (!row.reason && total + row.amount > schedule.batchLimit) {
        row.reason = "Batch limit reached";
        row.amount = 0;
      }
      total += row.amount;
    }
    return {
      schedule,
      nextRunAt:
        schedule.frequency === "paused"
          ? null
          : payoutWindow(schedule, now).next,
      rows,
      total,
      ready: ready(),
      simulated: cfg.paymentMode === "demo",
      truncated: professionals.length === 500,
    };
  }
  async function scheduled(now = Date.now(), forceDemo = false) {
    const schedule = await settings();
    if (schedule.frequency === "paused" || !ready())
      return { queued: 0, skipped: "paused_or_unconfigured" };
    const window = payoutWindow(schedule, now);
    if (!forceDemo && schedule.lastRunPeriod === window.date)
      return { queued: 0, skipped: "already_ran" };
    if (!forceDemo && (!schedule.enabledAt || window.due < schedule.enabledAt))
      return { queued: 0, skipped: "not_due" };
    const professionals = await store.list("professionals", [], 500);
    let queued = 0;
    for (const original of professionals.sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      if (original.type !== "Partner") continue;
      const reserved = await store.transaction(async (tx) => {
        const latest = await settings(tx);
        if (
          latest.frequency === "paused" ||
          latest.updatedAt !== schedule.updatedAt
        )
          return;
        const id = hash("scheduled:" + window.date + ":" + original.id);
        if (await tx.get("payouts", id)) return;
        const p = await tx.get("professionals", original.id),
          wallet = await tx.get("wallets", original.id),
          user = await tx.get("users", original.id);
        if (!p) return;
        const eligible = eligibility(p, wallet, user, latest, now);
        if (eligible.reason) return;
        const batchId = "scheduled_" + window.date,
          batch = (await tx.get("payoutBatches", batchId)) || {
            id: batchId,
            amount: 0,
            count: 0,
            createdAt: now,
          };
        if (batch.amount + eligible.amount > latest.batchLimit) return;
        wallet.available -= eligible.amount;
        wallet.held += eligible.amount;
        tx.put("wallets", wallet);
        const payout = {
          id,
          professionalId: p.id,
          professionalName: p.name,
          amount: eligible.amount,
          status: latest.approvalRequired ? "requested" : "processing",
          fundAccountId: p.fundAccountId,
          bankLast4: p.bankLast4,
          source: "scheduled",
          batchId,
          scheduledFor: window.due,
          createdAt: now,
          paymentEnvironment: paymentEnvironment(cfg),
        };
        tx.put("payouts", payout);
        tx.put("payoutBatches", {
          ...batch,
          amount: batch.amount + payout.amount,
          count: batch.count + 1,
        });
        if (!latest.approvalRequired) queuePayout(tx, payout, now);
        business.audit(tx, actor, "scheduled_payout_reserved", id, {
          amount: payout.amount,
          batchId,
        });
        business.notify(
          tx,
          p.id,
          "Scheduled payout",
          latest.approvalRequired
            ? "Your earnings are reserved for Owner approval."
            : "Your scheduled payout is being processed.",
        );
        return true;
      });
      if (reserved) queued++;
    }
    await store.transaction(async (tx) => {
      const latest = await settings(tx);
      if (latest.updatedAt === schedule.updatedAt)
        tx.put("settings", {
          ...latest,
          id: "payoutSchedule",
          lastRunPeriod: window.date,
          lastRunAt: now,
        });
    });
    return {
      queued,
      period: window.date,
      truncated: professionals.length === 500,
    };
  }
  async function saveBank(user, details) {
    const lease = randomUUID();
    await store.transaction(async (tx) => {
      const p = await tx.get("professionals", user.id),
        wallet = await tx.get("wallets", user.id);
      if (!p?.approved || p.type !== "Partner")
        fail(409, "Only approved partners can add payout accounts.");
      if (
        (wallet?.held || 0) > 0 ||
        p.bankUpdateLease ||
        ["processing", "unknown"].includes(p.bankVerification)
      )
        fail(
          409,
          "Finish or reconcile pending payouts and bank verification before changing accounts.",
        );
      tx.put("professionals", { ...p, bankUpdateLease: lease });
    });
    try {
      const account = await gateway.fundAccount(user, details);
      await store.transaction(async (tx) => {
        const p = await tx.get("professionals", user.id);
        if (p.bankUpdateLease !== lease || !p.approved)
          fail(409, "Professional approval changed. Contact the Owner.");
        const next = {
          ...p,
          contactId: account.contactId,
          fundAccountId: account.fundAccountId,
          bankLast4: account.last4,
          bankHolderName: details.name,
          bankIfsc: details.ifsc,
          bankVerification: "unverified",
          bankChangedAt: Date.now(),
          bankEligibleAt:
            Date.now() +
            (cfg.paymentMode === "demo" ? 0 : cfg.bankChangeCooldownHours) *
              3600000,
        };
        delete next.bankUpdateLease;
        delete next.bankVerificationId;
        delete next.bankRegisteredName;
        tx.put("professionals", next);
        business.audit(tx, user, "payout_account_added", user.id);
      });
      return { last4: account.last4, verification: "unverified" };
    } catch (error) {
      await store.transaction(async (tx) => {
        const p = await tx.get("professionals", user.id);
        if (p?.bankUpdateLease === lease) {
          delete p.bankUpdateLease;
          tx.put("professionals", p);
        }
      });
      throw error;
    }
  }
  async function applyValidation(tx, record, result) {
    const p = await tx.get("professionals", record.professionalId);
    if (
      !p ||
      p.bankVerificationId !== record.id ||
      p.fundAccountId !== record.fundAccountId
    )
      fail(409, "Bank account changed during verification.");
    if (
      result.fund_account?.id !== record.fundAccountId ||
      result.amount !== 100 ||
      result.currency !== "INR" ||
      (record.gatewayId && record.gatewayId !== result.id)
    )
      fail(
        400,
        "Bank validation does not match this account.",
        "BANK_VALIDATION_MISMATCH",
      );
    if (["verified", "needs_review", "failed"].includes(record.status))
      return record.status;
    const details = result.results || result.validation_results || {};
    const status =
      result.status === "failed"
        ? "failed"
        : result.status === "completed"
          ? details.account_status === "active"
            ? normalName(details.registered_name) &&
              normalName(details.registered_name) ===
                normalName(p.bankHolderName)
              ? "verified"
              : "needs_review"
            : "failed"
          : "processing";
    record.gatewayId = result.id;
    record.status = status;
    record.updatedAt = Date.now();
    record.accountStatus = String(details.account_status || "").slice(0, 40);
    record.registeredName = String(details.registered_name || "").slice(0, 100);
    p.bankVerification = status;
    p.bankRegisteredName = record.registeredName;
    if (status === "verified") p.bankVerifiedAt = Date.now();
    tx.put("bankVerifications", record);
    tx.put("professionals", p);
    if (status !== "processing") {
      business.notify(
        tx,
        p.id,
        "Bank verification updated",
        status === "verified"
          ? "Your payout account has been verified."
          : status === "needs_review"
            ? "The Owner must review the bank account holder name."
            : "Bank verification failed. Check your account details.",
      );
      business.audit(tx, actor, "bank_verification_" + status, record.id);
    }
    return status;
  }
  async function verifyBank(user) {
    if (
      cfg.paymentMode !== "demo" &&
      (!cfg.bankVerificationEnabled || cfg.paymentEnvironment !== "live")
    )
      fail(
        503,
        "₹1 verification requires RazorpayX live account validation. Use the sample demo to preview it.",
        "BANK_VERIFICATION_NOT_CONFIGURED",
      );
    const id = randomUUID();
    const p = await store.transaction(async (tx) => {
      const profile = await tx.get("professionals", user.id);
      if (
        !profile?.approved ||
        profile.type !== "Partner" ||
        !profile.fundAccountId ||
        profile.bankUpdateLease
      )
        fail(409, "Save an approved partner bank account first.");
      if (profile.bankVerification === "verified")
        return { ...profile, alreadyVerified: true };
      if (
        ["processing", "unknown", "needs_review"].includes(
          profile.bankVerification,
        )
      )
        fail(
          409,
          "Check the existing verification instead of sending another ₹1.",
        );
      const record = {
        id,
        professionalId: user.id,
        fundAccountId: profile.fundAccountId,
        status: "processing",
        createdAt: Date.now(),
      };
      profile.bankVerificationId = id;
      profile.bankVerification = "processing";
      tx.put("professionals", profile);
      tx.put("bankVerifications", record);
      return profile;
    });
    if (p.alreadyVerified) return { status: "verified" };
    try {
      const result = await gateway.validateBank(p, id);
      const status = await store.transaction(async (tx) =>
        applyValidation(tx, await tx.get("bankVerifications", id), result),
      );
      return { status, simulated: cfg.paymentMode === "demo" };
    } catch (error) {
      await store.transaction(async (tx) => {
        const record = await tx.get("bankVerifications", id),
          profile = await tx.get("professionals", user.id);
        if (
          record?.status === "processing" &&
          profile?.bankVerificationId === id
        ) {
          record.status =
            error.code === "BANK_VERIFICATION_NOT_CONFIGURED"
              ? "failed"
              : "unknown";
          profile.bankVerification = record.status;
          tx.put("bankVerifications", record);
          tx.put("professionals", profile);
        }
      });
      throw error;
    }
  }
  async function checkBank(user, suppliedId) {
    const p = await store.get("professionals", user.id),
      record =
        p?.bankVerificationId &&
        (await store.get("bankVerifications", p.bankVerificationId));
    if (!record) fail(409, "Start bank verification first.");
    const id = record.gatewayId || suppliedId;
    if (!id)
      fail(
        409,
        "The provider outcome is uncertain. Ask the Owner to reconcile the validation from RazorpayX.",
      );
    const result = await gateway.bankValidationStatus(id);
    return {
      status: await store.transaction(async (tx) =>
        applyValidation(
          tx,
          await tx.get("bankVerifications", record.id),
          result,
        ),
      ),
    };
  }
  return {
    ready,
    settings,
    saveSchedule,
    preview,
    scheduled,
    saveBank,
    verifyBank,
    checkBank,
    applyValidation,
  };
}
export function queuePayout(tx, payout, now = Date.now()) {
  tx.put("jobs", {
    id: "payout_" + payout.id,
    type: "payout",
    payoutId: payout.id,
    status: "pending",
    attempts: 0,
    dueAt: now,
    createdAt: now,
  });
}

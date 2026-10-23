import { runHomeCareReminders } from "./home-care.mjs";
import { randomUUID } from "node:crypto";
import {
  assertBookingEnvironment,
  isReviewRecord,
} from "./payment-environment.mjs";
export function workers(store, business, gateway, cfg, firebase = {}, payouts) {
  async function maintenance(now = Date.now()) {
    const expiring = await store.list(
      "bookings",
      [
        ["status", "==", "payment_pending"],
        ["expiresAt", "<=", now],
      ],
      100,
    );
    for (const record of expiring)
      await store.transaction(async (tx) => {
        const b = await tx.get("bookings", record.id);
        if (b.status !== "payment_pending" || b.expiresAt > now) return;
        await business.release(tx, b);
        await business.releasePromo(tx, b);
        b.status = "payment_expired";
        tx.put("bookings", b);
        business.notify(
          tx,
          b.customerId,
          "Payment reservation expired",
          "Choose another slot to book your service.",
          b.id,
        );
      });
    const waiting = await store.list(
      "bookings",
      [
        ["status", "in", ["assigned", "awaiting_assignment"]],
        ["assignmentDueAt", "<=", now],
      ],
      100,
    );
    for (const record of waiting)
      await store.transaction(async (tx) => {
        const b = await tx.get("bookings", record.id);
        if (!["assigned", "awaiting_assignment"].includes(b.status)) return;
        try {
          assertBookingEnvironment(b, cfg);
        } catch {
          return;
        }
        const company = await business.settings(tx);
        const deadline =
          b.assignmentDueAt ||
          (b.paidAt || b.createdAt) + company.assignmentDeadlineMinutes * 60000;
        if (deadline > now) return;
        if (b.status === "assigned") {
          await business.release(tx, b);
          b.declinedProfessionalIds = [
            ...(b.declinedProfessionalIds || []),
            b.professionalId,
          ];
          delete b.professionalId;
        }
        if (await business.assign(tx, b)) {
          b.assignmentDueAt = now + company.assignmentDeadlineMinutes * 60000;
          tx.put("bookings", b);
          return;
        }
        b.status = "cancelled";
        b.cancelReason = "No professional available before assignment deadline";
        b.refund = "processing";
        tx.put("bookings", b);
        tx.put("jobs", {
          id: "refund_" + b.id,
          type: "refund",
          bookingId: b.id,
          status: "pending",
          attempts: 0,
          dueAt: now,
          createdAt: now,
        });
        business.notify(
          tx,
          b.customerId,
          "Service could not be fulfilled",
          "A full refund is being processed.",
          b.id,
        );
      });
    const requests = await store.list(
      "tickets",
      [["status", "==", "open"]],
      100,
    );
    let escalations = 0;
    for (const record of requests)
      await store.transaction(async (tx) => {
        const t = await tx.get("tickets", record.id);
        if (
          !t ||
          t.status !== "open" ||
          t.awaitingResponse === false ||
          t.escalatedAt ||
          (t.responseDueAt || t.createdAt + 4 * 3600000) > now
        )
          return;
        const staff = await tx.list(
          "users",
          [
            ["role", "in", ["owner", "care"]],
            ["active", "==", true],
          ],
          100,
        );
        t.escalatedAt = now;
        t.priority = "high";
        tx.put("tickets", t);
        for (const user of staff)
          business.notify(
            tx,
            user.id,
            "Support response overdue",
            "Review request #" +
              t.id.slice(0, 8) +
              " and reply to the customer.",
            t.bookingId,
          );
        escalations++;
      });
    return {
      expired: expiring.length,
      assignmentChecks: waiting.length,
      escalations,
    };
  }
  async function financialJobs() {
    const jobs = await store.list(
      "jobs",
      [
        ["status", "==", "pending"],
        ["dueAt", "<=", Date.now()],
      ],
      20,
    );
    for (const original of jobs) {
      const lease = randomUUID();
      const claimed = await store.transaction(async (tx) => {
        const job = await tx.get("jobs", original.id);
        if (job.status !== "pending") return false;
        job.status = "processing";
        job.lease = lease;
        job.startedAt = Date.now();
        job.attempts++;
        tx.put("jobs", job);
        return true;
      });
      if (!claimed) continue;
      try {
        if (original.type === "refund") {
          const b = await store.get("bookings", original.bookingId);
          assertBookingEnvironment(b, cfg);
          const r = await gateway.refund(b, original.id);
          await store.transaction(async (tx) => {
            const job = await tx.get("jobs", original.id),
              latest = await tx.get("bookings", b.id);
            if (job.lease !== lease) return;
            latest.refundId = r.id;
            latest.refund =
              latest.refund === "refunded" || r.status === "processed"
                ? "refunded"
                : latest.refund === "failed"
                  ? "failed"
                  : "processing";
            if (latest.refund === "refunded") latest.payment = "refunded";
            tx.put("bookings", latest);
            job.status =
              latest.refund === "refunded"
                ? "done"
                : latest.refund === "failed"
                  ? "needs_reconciliation"
                  : "awaiting_webhook";
            job.gatewayId = r.id;
            tx.put("jobs", job);
            business.notify(
              tx,
              latest.customerId,
              "Refund updated",
              latest.refund === "refunded"
                ? "Your refund has been processed."
                : "Your refund is being processed.",
              latest.id,
            );
          });
        }
        if (original.type === "payout") {
          const payout = await store.get("payouts", original.payoutId),
            professional = await store.get(
              "professionals",
              payout.professionalId,
            );
          const user = await store.get("users", payout.professionalId);
          assertBookingEnvironment(payout, cfg);
          if (
            isReviewRecord(professional) ||
            !professional?.approved ||
            professional.bankVerification !== "verified" ||
            user?.active === false ||
            !payout.fundAccountId ||
            payout.fundAccountId !== professional.fundAccountId
          )
            throw Object.assign(new Error("Verified payout bank changed."), {
              code: "PAYOUT_BANK_REVIEW_REQUIRED",
            });
          const result = await gateway.payout(payout, {
            ...professional,
            fundAccountId: payout.fundAccountId,
          });
          await store.transaction(async (tx) => {
            const job = await tx.get("jobs", original.id),
              p = await tx.get("payouts", payout.id);
            if (job.lease !== lease) return;
            job.gatewayId = result.id;
            const alreadySettled = ["paid", "failed", "reversed"].includes(
              p.status,
            );
            job.status =
              alreadySettled || result.status === "processed"
                ? "done"
                : "awaiting_webhook";
            p.gatewayId = result.id;
            if (!alreadySettled)
              p.status = result.status === "processed" ? "paid" : "processing";
            tx.put("jobs", job);
            tx.put("payouts", p);
            if (p.status === "paid" && !alreadySettled) {
              const wallet = await tx.get("wallets", p.professionalId);
              wallet.held -= p.amount;
              wallet.paid += p.amount;
              tx.put("wallets", wallet);
            }
            business.notify(
              tx,
              p.professionalId,
              "Payout updated",
              p.status === "paid"
                ? "Your partner payout is complete."
                : "Your payout is being processed.",
            );
          });
        }
      } catch (e) {
        await store.transaction(async (tx) => {
          const job = await tx.get("jobs", original.id);
          if (job.lease !== lease) return;
          job.status = "needs_reconciliation";
          job.errorCode = e.code || "UNKNOWN_GATEWAY_OUTCOME";
          tx.put("jobs", job);
        });
      }
    }
    const stale = await store.list(
      "jobs",
      [
        ["status", "==", "processing"],
        ["startedAt", "<=", Date.now() - 5 * 60000],
      ],
      20,
    );
    for (const job of stale)
      await store.transaction(async (tx) => {
        const current = await tx.get("jobs", job.id);
        if (current.status === "processing") {
          current.status = "needs_reconciliation";
          tx.put("jobs", current);
        }
      });
    return { processed: jobs.length };
  }
  async function push() {
    if (!cfg.live) return { skipped: true };
    const now = Date.now(),
      due = await store.list(
        "outbox",
        [
          ["status", "in", ["pending", "sending"]],
          ["dueAt", "<=", now],
        ],
        50,
      );
    let sent = 0;
    for (const item of due) {
      const lease = randomUUID();
      const claimed = await store.transaction(async (tx) => {
        const n = await tx.get("outbox", item.id);
        if (
          (n.status === "sending" && n.dueAt > now) ||
          !["pending", "sending"].includes(n.status)
        )
          return false;
        n.status = "sending";
        n.lease = lease;
        n.dueAt = now + 120000;
        tx.put("outbox", n);
        return true;
      });
      if (!claimed) continue;
      const tokens = await store.list(
        "devices",
        [
          ["userId", "==", item.userId],
          ["active", "==", true],
        ],
        5,
      );
      if (!tokens.length) {
        await store.transaction(async (tx) => {
          const n = await tx.get("outbox", item.id);
          if (n.lease === lease) {
            n.status = "no_device";
            tx.put("outbox", n);
          }
        });
        continue;
      }
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cfg.pushAccessToken
              ? { Authorization: "Bearer " + cfg.pushAccessToken }
              : {}),
          },
          body: JSON.stringify(
            tokens.map((d) => ({
              to: d.token,
              title: item.title,
              body: item.body,
              sound: "default",
              channelId: "default",
              data: { bookingId: item.bookingId, notificationId: item.id },
            })),
          ),
          signal: AbortSignal.timeout(10000),
        });
        const result = await response.json();
        if (
          !response.ok ||
          !Array.isArray(result.data) ||
          result.data.length !== tokens.length
        )
          throw new Error("PUSH_FAILED");
        await store.transaction(async (tx) => {
          const n = await tx.get("outbox", item.id);
          if (n.lease !== lease) return;
          n.status = "sent";
          n.sentAt = Date.now();
          n.receiptDueAt = Date.now() + 15 * 60000;
          n.receipts = [];
          let retry = false;
          for (let i = 0; i < result.data.length; i++) {
            const ticket = result.data[i];
            if (ticket.status === "ok")
              n.receipts.push({ id: ticket.id, deviceId: tokens[i].id });
            else if (ticket.details?.error === "DeviceNotRegistered")
              tx.put("devices", { ...tokens[i], active: false });
            else retry = true;
          }
          if (retry && !n.receipts.length) {
            n.attempts++;
            n.status = n.attempts >= 5 ? "failed" : "pending";
            n.dueAt = Date.now() + 2 ** n.attempts * 60000;
          }
          tx.put("outbox", n);
        });
        sent++;
      } catch {
        await store.transaction(async (tx) => {
          const n = await tx.get("outbox", item.id);
          if (n.lease !== lease) return;
          n.attempts++;
          n.status = n.attempts >= 5 ? "failed" : "pending";
          n.dueAt = Date.now() + Math.min(3600000, 2 ** n.attempts * 60000);
          tx.put("outbox", n);
        });
      }
    }
    const awaiting = await store.list(
      "outbox",
      [
        ["status", "==", "sent"],
        ["receiptDueAt", "<=", Date.now()],
      ],
      50,
    );
    for (const item of awaiting) {
      if (!item.receipts?.length) continue;
      try {
        const response = await fetch(
          "https://exp.host/--/api/v2/push/getReceipts",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(cfg.pushAccessToken
                ? { Authorization: "Bearer " + cfg.pushAccessToken }
                : {}),
            },
            body: JSON.stringify({ ids: item.receipts.map((r) => r.id) }),
            signal: AbortSignal.timeout(10000),
          },
        );
        const result = await response.json();
        if (!response.ok || !result.data) continue;
        await store.transaction(async (tx) => {
          const current = await tx.get("outbox", item.id);
          let missing = false,
            error = false;
          for (const r of item.receipts) {
            const receipt = result.data[r.id];
            if (!receipt) {
              missing = true;
              continue;
            }
            if (receipt.status === "error") error = true;
            if (receipt.details?.error === "DeviceNotRegistered") {
              const d = await tx.get("devices", r.deviceId);
              if (d) tx.put("devices", { ...d, active: false });
            }
          }
          current.status = missing
            ? Date.now() - item.sentAt > 24 * 3600000
              ? "receipt_unknown"
              : "sent"
            : error
              ? "delivery_failed"
              : "delivered";
          current.receiptDueAt = Date.now() + 15 * 60000;
          tx.put("outbox", current);
        });
      } catch {}
    }
    return { sent, receiptChecks: awaiting.length };
  }
  async function cleanup() {
    if (!cfg.live) return { skipped: true };
    const records = await store.list(
      "cleanup",
      [["status", "==", "pending"]],
      10,
    );
    for (const record of records) {
      try {
        if (!firebase.bucket) continue;
        for (const storagePath of record.paths)
          await firebase.bucket
            .file(storagePath)
            .delete({ ignoreNotFound: true });
        await store.transaction(async (tx) => tx.remove("cleanup", record.id));
      } catch {}
    }
    const identities = await store.list(
      "identityCleanup",
      [["status", "==", "pending"]],
      10,
    );
    for (const record of identities) {
      try {
        await firebase.auth.deleteUser(record.id);
        await store.transaction(async (tx) =>
          tx.remove("identityCleanup", record.id),
        );
      } catch (e) {
        if (e.code === "auth/user-not-found")
          await store.transaction(async (tx) =>
            tx.remove("identityCleanup", record.id),
          );
      }
    }
    for (const kind of ["quota", "checkoutTickets", "locks", "messages"]) {
      const cutoff = Date.now() - (kind === "messages" ? 0 : 86400000);
      const expired = await store.list(
        kind,
        [["expiresAt", "<=", cutoff]],
        100,
      );
      if (expired.length)
        await store.transaction(async (tx) => {
          for (const record of expired) {
            const current = await tx.get(kind, record.id);
            if (current?.expiresAt <= cutoff) tx.remove(kind, record.id);
          }
        });
    }
    return { documents: records.length, identities: identities.length };
  }
  async function reconciliation() {
    const pending = await store.list(
      "jobs",
      [["status", "==", "awaiting_webhook"]],
      20,
    );
    for (const job of pending) {
      try {
        if (job.type === "refund") {
          const b = await store.get("bookings", job.bookingId);
          try {
            assertBookingEnvironment(b, cfg);
          } catch (e) {
            await store.transaction(async (tx) => {
              const current = await tx.get("jobs", job.id);
              if (current.status === "awaiting_webhook")
                tx.put("jobs", {
                  ...current,
                  status: "needs_reconciliation",
                  errorCode: e.code,
                });
            });
            continue;
          }
          const record = await gateway.refundStatus(job.gatewayId);
          if (
            record.amount !== b.total * 100 ||
            record.payment_id !== b.paymentId
          )
            continue;
          await store.transaction(async (tx) => {
            const latest = await tx.get("bookings", b.id),
              current = await tx.get("jobs", job.id);
            if (record.status === "processed") {
              latest.refund = "refunded";
              latest.payment = "refunded";
              current.status = "done";
            } else if (
              record.status === "failed" &&
              latest.refund !== "refunded"
            ) {
              latest.refund = "failed";
              current.status = "needs_reconciliation";
            }
            tx.put("bookings", latest);
            tx.put("jobs", current);
          });
        } else if (job.type === "payout") {
          const p = await store.get("payouts", job.payoutId),
            professional = await store.get("professionals", p.professionalId);
          try {
            assertBookingEnvironment(p, cfg);
            if (isReviewRecord(professional))
              throw Object.assign(
                new Error("Review-only professional cannot receive payouts."),
                { code: "REVIEW_ONLY" },
              );
          } catch (e) {
            await store.transaction(async (tx) => {
              const current = await tx.get("jobs", job.id);
              if (current.status === "awaiting_webhook")
                tx.put("jobs", {
                  ...current,
                  status: "needs_reconciliation",
                  errorCode: e.code,
                });
            });
            continue;
          }
          const record = await gateway.payoutStatus(job.gatewayId);
          if (
            record.amount !== p.amount * 100 ||
            record.reference_id !== p.id ||
            record.currency !== "INR"
          )
            continue;
          await store.transaction(async (tx) => {
            const latest = await tx.get("payouts", p.id),
              current = await tx.get("jobs", job.id),
              wallet = await tx.get("wallets", p.professionalId);
            if (
              record.status === "processed" &&
              latest.status === "processing"
            ) {
              wallet.held -= p.amount;
              wallet.paid += p.amount;
              latest.status = "paid";
              current.status = "done";
            } else if (
              ["failed", "reversed"].includes(record.status) &&
              !["failed", "reversed"].includes(latest.status)
            ) {
              if (latest.status === "paid") wallet.paid -= p.amount;
              else wallet.held -= p.amount;
              wallet.available += p.amount;
              latest.status = record.status;
              current.status = "done";
            }
            tx.put("wallets", wallet);
            tx.put("payouts", latest);
            tx.put("jobs", current);
          });
        }
      } catch {}
    }
    return { checked: pending.length };
  }
  return {
    maintenance,
    financialJobs,
    push,
    cleanup,
    reconciliation,
    async run() {
      try {
        const result = {
          maintenance: await maintenance(),
          scheduledPayouts: await payouts?.scheduled(),
          finance: await financialJobs(),
          reconciliation: await reconciliation(),
          homeCare: await runHomeCareReminders(store, business),
          push: await push(),
          cleanup: await cleanup(),
        };
        await store.transaction(async (tx) =>
          tx.put("settings", {
            id: "workerHeartbeat",
            at: Date.now(),
            ok: true,
          }),
        );
        return result;
      } catch (error) {
        await store
          .transaction(async (tx) =>
            tx.put("settings", {
              id: "workerHeartbeat",
              at: Date.now(),
              ok: false,
              code: error.code || "WORKER_FAILED",
            }),
          )
          .catch(() => {});
        throw error;
      }
    },
  };
}

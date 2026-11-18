import { fail } from "./errors.mjs";

export const paymentEnvironment = (cfg) =>
  cfg.paymentMode === "demo" ? "simulated" : cfg.paymentEnvironment;

export const isReviewRecord = (record) =>
  record?.reviewOnly === true || record?.id?.startsWith("review-") === true;

export const isReviewBooking = (booking) =>
  isReviewRecord(booking) ||
  booking?.paymentEnvironment === "test" ||
  [
    booking?.serviceId,
    booking?.professionalId,
    booking?.reservedProfessionalId,
  ].some((id) => id?.startsWith("review-"));

export function assertBookingEnvironment(booking, cfg) {
  const active = paymentEnvironment(cfg);
  if (active === "live" && isReviewBooking(booking))
    fail(
      409,
      "Review bookings cannot use live payment credentials.",
      "REVIEW_ONLY",
    );
  // Unsnapshotted legacy records remain compatible, with review markers enforced.
  if (booking?.paymentEnvironment && booking.paymentEnvironment !== active)
    fail(
      409,
      "This transaction belongs to a different payment environment. Reconcile it using its original credentials.",
      "PAYMENT_ENVIRONMENT_MISMATCH",
    );
}

// Local demo fixtures may use review-prefixed professional IDs; their simulated
// money keeps its existing demo behavior. Explicit review/test money is isolated.
export const earningsCollections = (booking) =>
  booking?.reviewOnly === true || booking?.paymentEnvironment === "test"
    ? { wallets: "reviewWallets", ledger: "reviewLedger" }
    : { wallets: "wallets", ledger: "ledger" };

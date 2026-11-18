import type { Booking, Role } from "./model";

type DispatchBooking = Pick<
  Booking,
  | "status"
  | "payment"
  | "dispatch"
  | "professionalType"
  | "arrivedAt"
  | "refund"
>;

export function offerSecondsRemaining(expiresAt: number, now = Date.now()) {
  return Number.isFinite(expiresAt) && Number.isFinite(now)
    ? Math.max(0, Math.ceil((expiresAt - now) / 1000))
    : 0;
}

export function canOperateInternalBooking(b: DispatchBooking, role: Role) {
  return (
    ["owner", "care"].includes(role) &&
    b.dispatch?.version === 1 &&
    b.professionalType === "In-house" &&
    b.payment === "paid" &&
    !b.refund &&
    ["confirmed", "in_progress"].includes(b.status)
  );
}

export function dispatchSummary(
  b: DispatchBooking,
  viewer: "customer" | "staff" = "customer",
  now = Date.now(),
): { label: string; detail: string; attention: boolean } | null {
  if (
    !b.dispatch ||
    b.payment !== "paid" ||
    !["awaiting_assignment", "assigned", "confirmed"].includes(b.status)
  )
    return null;
  const d = b.dispatch;
  const expired =
    d.state === "offering" && !offerSecondsRemaining(d.expiresAt || 0, now);
  if (d.state === "attention" || expired)
    return {
      label:
        viewer === "staff"
          ? expired
            ? "Partner offer expired"
            : "Office follow-up needed"
          : "Office arranging your visit",
      detail:
        viewer === "staff"
          ? "Review availability, assign an internal worker or retry eligible partner offers. Contact the customer if arrangements change."
          : "Our office is checking team availability. Contact ANVIRA support if you need an update.",
      attention: true,
    };
  if (d.state === "offering")
    return {
      label:
        viewer === "staff"
          ? "Waiting for a partner"
          : "Office arranging your visit",
      detail:
        viewer === "staff"
          ? "Approved partners are reviewing this offer. The first eligible acceptance confirms the job."
          : "ANVIRA will confirm your assigned professional here. Your selected time and agreed price remain visible below.",
      attention: false,
    };
  if (d.state === "awaiting_staff")
    return {
      label:
        viewer === "staff"
          ? "Awaiting office dispatch"
          : "Office arranging your visit",
      detail:
        viewer === "staff"
          ? "Payment is received. Assign an available internal worker and record dispatch."
          : "Your payment is received. Our office will assign and dispatch your team for the selected time.",
      attention: false,
    };
  if (b.arrivedAt)
    return {
      label:
        b.professionalType === "In-house"
          ? "Team arrived"
          : "Professional arrived",
      detail:
        "Arrival has been recorded. Please meet your professional at the service address.",
      attention: false,
    };
  if (d.state === "dispatched")
    return {
      label: "Team dispatched",
      detail:
        "Our office has sent your team for the scheduled visit. Contact ANVIRA support if you need an update.",
      attention: false,
    };
  if (d.state === "claimed")
    return {
      label: "Partner confirmed",
      detail:
        "Your approved professional has accepted this visit. ANVIRA support remains available from this booking.",
      attention: false,
    };
  return {
    label: "Team assigned",
    detail: "Our office has confirmed your team and will record dispatch here.",
    attention: false,
  };
}

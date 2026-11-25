export const dispatchReasons: Record<string, string> = {
  CHECKING_CAPACITY: "Checking ANVIRA availability",
  INTERNAL_ASSIGNED: "ANVIRA team assigned",
  CHECKING_PARTNERS: "Checking outside professionals",
  WAITING_FOR_PARTNER: "Waiting for an outside professional to accept",
  PARTNER_ACCEPTED: "Outside professional accepted",
  PARTNER_FALLBACK_DISABLED:
    "Outside professionals are disabled for this service or business",
  NO_ELIGIBLE_PARTNERS: "No eligible outside professionals are available",
  NO_PARTNER_ACCEPTED:
    "No outside professional accepted within the offer window",
  NO_ACTIVE_PROFESSIONAL_ACCOUNT: "No active professional account",
  ELIGIBLE: "Eligible for this visit",
  NOT_APPROVED_OR_INACTIVE: "Not approved or account inactive",
  WRONG_SERVICE: "Does not provide this service",
  OUTSIDE_AREA: "Does not cover this PIN code",
  INTERNAL_PAUSED: "ANVIRA team paused for this service and area",
  UNAVAILABLE: "Marked unavailable",
  SCHEDULE_OR_TIME_CONFLICT:
    "Outside working hours, on leave or already booked",
};
export const dispatchStages: Record<string, string> = {
  checking_partners: "Checking outside availability",
  awaiting_staff: "Waiting for office assignment",
  assigned: "ANVIRA team assigned",
  offering: "Outside job offers opened",
  claimed: "Outside professional accepted",
  attention: "Office action needed",
  dispatched: "ANVIRA team dispatched",
};
export const pushStates: Record<string, string> = {
  delivered: "Push provider receipt confirmed",
  delivery_failed: "Push provider reported failure",
  receipt_unknown: "Push provider receipt unavailable",
  pending: "Push queued",
  sending: "Sending to push provider",
  sent: "Submitted to push provider",
  no_device: "No registered notification device",
  failed: "Push failed",
  suppressed: "Offer no longer current",
  in_app_only: "In-app offer available",
};

export const PARTNER_OFFER_CHANNEL = "partner-offers-v1";
export const PARTNER_OFFER_SOUND = "partner-offer.wav";

export type PartnerOfferAlert = {
  kind: "partner_offer";
  offerId: string;
  roundId: string;
  expiresAt: number;
};
const safeId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);

export function isPartnerOfferAlert(
  data: Record<string, unknown>,
): data is PartnerOfferAlert {
  return (
    data.kind === "partner_offer" &&
    typeof data.offerId === "string" &&
    /^[a-zA-Z0-9_-]{1,256}$/.test(data.offerId) &&
    safeId(data.roundId) &&
    typeof data.expiresAt === "number" &&
    Number.isFinite(data.expiresAt)
  );
}

export function notificationRoute(
  data: Record<string, unknown>,
  role?: string,
) {
  if (data.kind === "partner_offer")
    return isPartnerOfferAlert(data) && role === "professional"
      ? "/jobs"
      : null;
  return safeId(data.bookingId) ? "/booking/" + data.bookingId : null;
}

export function currentPartnerAlert(
  data: Record<string, unknown>,
  offers: { id: string; roundId: string; expiresAt: number }[],
  now = Date.now(),
) {
  return (
    isPartnerOfferAlert(data) &&
    data.expiresAt > now &&
    offers.some(
      (offer) =>
        offer.id === data.offerId &&
        offer.roundId === data.roundId &&
        offer.expiresAt > now,
    )
  );
}

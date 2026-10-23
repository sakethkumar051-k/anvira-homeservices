import { z } from "zod";
import { fail, assertRole } from "./errors.mjs";
export const laundryStages = [
  "collected",
  "received",
  "processing",
  "ready",
  "out_for_delivery",
  "delivered",
];
export function advanceLaundry(booking, user, input) {
  assertRole(user, "owner", "care", "professional");
  if (user.role === "professional" && booking.professionalId !== user.id)
    fail(403, "Only the assigned professional can update this laundry.");
  if (
    booking.fulfillmentType !== "laundry" ||
    booking.payment !== "paid" ||
    booking.status !== "in_progress"
  )
    fail(409, "Start the paid laundry job before updating its progress.");
  const v = z
    .object({
      stage: z.enum(laundryStages),
      revision: z.number().int().nonnegative(),
      note: z.string().trim().min(3).max(500),
    })
    .parse(input);
  const current = booking.laundry || { revision: 0, history: [] };
  if (current.revision !== v.revision)
    fail(409, "Laundry progress changed. Refresh and try again.");
  if (laundryStages.indexOf(v.stage) !== current.history.length)
    fail(409, "Update the next laundry stage in order.");
  booking.laundry = {
    stage: v.stage,
    revision: current.revision + 1,
    history: [
      ...current.history,
      { stage: v.stage, note: v.note, at: Date.now(), actor: user.id },
    ],
  };
  return booking;
}

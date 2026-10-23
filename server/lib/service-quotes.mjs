import { z } from "zod";
import { fail, assertRole } from "./errors.mjs";
export const quoteAddress = z.object({
  line: z.string().trim().min(8).max(300),
  pin: z.string().regex(/^\d{6}$/),
  label: z.string().trim().max(40).default("Home"),
});
export function quoteAccess(user, quote) {
  assertRole(user, "customer", "owner", "care");
  if (!quote || (user.role === "customer" && quote.customerId !== user.id))
    fail(404, "Quote request not found.");
  return quote;
}
export async function quotedSelection(tx, user, input, service) {
  const q = quoteAccess(user, await tx.get("serviceQuotes", input.quoteId));
  if (q.status !== "accepted" || q.bookingId || q.expiresAt <= Date.now())
    fail(409, "This quote is no longer available for booking.");
  if (
    q.serviceId !== service.id ||
    JSON.stringify(q.address) !== JSON.stringify(input.address)
  )
    fail(409, "Use the service and address approved in this quote.");
  if (
    input.promoCode ||
    input.addons.length ||
    input.packageId ||
    Object.keys(input.options).length
  )
    fail(400, "A quoted price cannot be combined with packages or offers.");
  return {
    quote: q,
    selection: {
      price: q.total,
      subtotal: q.total,
      duration: q.duration,
      addons: [],
      choices: [],
      options: {},
      scope: [q.scope, ...q.items.map((x) => `${x.quantity} × ${x.label}`)],
    },
  };
}
export async function cleanupServiceQuotes(tx, userId) {
  const rows = await tx.list(
    "serviceQuotes",
    [["customerId", "==", userId]],
    201,
  );
  if (rows.length > 200)
    fail(409, "Contact support to close a high-volume quote account.");
  for (const q of rows) tx.remove("serviceQuotes", q.id);
}
export const proposalSchema = z.object({
  revision: z.number().int().nonnegative(),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(160),
        quantity: z.number().int().min(1).max(100),
        unitPrice: z.number().int().min(1).max(100000),
      }),
    )
    .min(1)
    .max(20),
  duration: z.number().int().min(30).max(240).multipleOf(30),
  scope: z.string().trim().min(10).max(2000),
  expiresAt: z.number().int(),
});

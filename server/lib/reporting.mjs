import { z } from "zod";
import { fail } from "./errors.mjs";
export const recentOrder = [
  ["createdAt", "desc"],
  ["id", "desc"],
];
export function pageCursor(value, idOnly = false) {
  if (!value) return undefined;
  try {
    const decoded = JSON.parse(z.string().max(220).parse(value));
    return (
      idOnly
        ? z.tuple([z.string().min(1).max(100)])
        : z.tuple([z.number().int().nonnegative(), z.string().min(1).max(100)])
    ).parse(decoded);
  } catch {
    fail(400, "Invalid page cursor.");
  }
}
export function pageResponse(records, idOnly = false) {
  const rows = records.slice(0, 100),
    last = rows.at(-1);
  return {
    rows,
    nextCursor:
      records.length > 100
        ? idOnly
          ? [last.id]
          : [last.createdAt, last.id]
        : null,
  };
}
export function reportRange(query) {
  if (query.from === undefined && query.to === undefined) return null;
  const from = z.coerce.number().int().nonnegative().parse(query.from),
    to = z.coerce.number().int().nonnegative().parse(query.to);
  if (to < from || to - from > 366 * 86400000)
    fail(400, "Choose a report range up to 366 days.");
  return { from, to };
}
export async function reportSummary(store, role, range = null) {
  const owner = role === "owner",
    now = Date.now(),
    day = new Date(now + 330 * 60000).toISOString().slice(0, 10),
    start = Date.parse(day + "T00:00:00+05:30"),
    filters = range
      ? [
          ["createdAt", ">=", range.from],
          ["createdAt", "<=", range.to],
        ]
      : [],
    count = (kind, extra = [], sums = []) =>
      store.aggregate(
        kind,
        [...(kind === "bookings" ? filters : []), ...extra],
        sums,
      );
  const [
    all,
    completed,
    today,
    approved,
    assignment,
    refunds,
    tickets,
    paid,
    refunded,
  ] = await Promise.all([
    count("bookings"),
    count("bookings", [["status", "==", "completed"]], owner ? ["total"] : []),
    store.aggregate("bookings", [
      ["slot", ">=", start],
      ["slot", "<", start + 86400000],
    ]),
    count("professionals", [["approved", "==", true]]),
    count("bookings", [["status", "==", "awaiting_assignment"]]),
    count("bookings", [["refund", "==", "requested"]]),
    count("tickets", [["status", "==", "open"]]),
    owner
      ? count("bookings", [["payment", "in", ["paid", "refunded"]]], ["total"])
      : null,
    owner
      ? count("bookings", [["payment", "==", "refunded"]], ["total"])
      : null,
  ]);
  const days = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const at = start - (6 - i) * 86400000,
        date = new Date(at + 330 * 60000).toISOString().slice(0, 10);
      return {
        date,
        count: (
          await store.aggregate("bookings", [
            ["createdAt", ">=", at],
            ["createdAt", "<", at + 86400000],
          ])
        ).count,
      };
    }),
  );
  const services =
    owner && range
      ? await Promise.all(
          (await store.list("services", [], 100)).map(async (service) => {
            const result = await count(
              "bookings",
              [
                ["serviceId", "==", service.id],
                ["status", "==", "completed"],
              ],
              ["total"],
            );
            return {
              id: service.id,
              name: service.name,
              completed: result.count,
              value: result.total,
            };
          }),
        )
      : [];
  return {
    generatedAt: now,
    range,
    bookings: all.count,
    completed: completed.count,
    completedValue: owner ? completed.total : null,
    capturedValue: owner ? paid.total : null,
    refundedValue: owner ? refunded.total : null,
    netCapturedValue: owner ? paid.total - refunded.total : null,
    todayBookings: today.count,
    approvedProfessionals: approved.count,
    awaitingAssignment: assignment.count,
    refundRequests: refunds.count,
    openTickets: tickets.count,
    days,
    services,
  };
}

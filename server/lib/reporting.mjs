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
export async function reportSummary(
  store,
  role,
  range = null,
  withInsights = false,
) {
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
  const insights = owner && withInsights && !range;
  const days = await Promise.all(
    Array.from({ length: 7 }, async (_, i) => {
      const at = start - (6 - i) * 86400000,
        date = new Date(at + 330 * 60000).toISOString().slice(0, 10),
        window = [
          ["createdAt", ">=", at],
          ["createdAt", "<", at + 86400000],
        ];
      const [created, paidDay] = await Promise.all([
        store.aggregate("bookings", window),
        insights
          ? store.aggregate(
              "bookings",
              [["payment", "==", "paid"], ...window],
              ["total"],
            )
          : null,
      ]);
      return {
        date,
        count: created.count,
        ...(paidDay ? { revenue: paidDay.total || 0 } : {}),
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
  const pulse = insights ? await businessPulse(store, start) : undefined;
  return {
    generatedAt: now,
    range,
    ...(pulse ? { pulse } : {}),
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

// Week-over-week business health for the owner overview. Every figure is a
// Firestore aggregate over existing indexes, so it costs a few reads at most.
async function businessPulse(store, todayStart) {
  const end = todayStart + 86400000,
    week = 7 * 86400000;
  const period = async (from, to) => {
    const window = [
      ["createdAt", ">=", from],
      ["createdAt", "<", to],
    ];
    const [created, paid, cancelled, completed] = await Promise.all([
      store.aggregate("bookings", window),
      store.aggregate(
        "bookings",
        [["payment", "==", "paid"], ...window],
        ["total"],
      ),
      store.aggregate("bookings", [["status", "==", "cancelled"], ...window]),
      store.aggregate("bookings", [["status", "==", "completed"], ...window]),
    ]);
    return {
      bookings: created.count,
      paidBookings: paid.count,
      revenue: paid.total || 0,
      averageOrder: paid.count ? Math.round((paid.total || 0) / paid.count) : 0,
      conversion: created.count
        ? Math.round((paid.count / created.count) * 100)
        : 0,
      cancelled: cancelled.count,
      completed: completed.count,
    };
  };
  const [current, previous, ratings, services] = await Promise.all([
    period(end - week, end),
    period(end - 2 * week, end - week),
    store.aggregate(
      "bookings",
      [["review.rating", ">=", 1]],
      ["review.rating"],
    ),
    store.list("services", [], 100),
  ]);
  const monthStart = end - 30 * 86400000;
  const top = (
    await Promise.all(
      services.map(async (service) => {
        const result = await store.aggregate(
          "bookings",
          [
            ["serviceId", "==", service.id],
            ["status", "==", "completed"],
            ["createdAt", ">=", monthStart],
          ],
          ["total"],
        );
        return {
          id: service.id,
          name: service.name,
          completed: result.count,
          value: result.total || 0,
        };
      }),
    )
  )
    .filter((service) => service.completed > 0)
    .sort((a, b) => b.value - a.value || b.completed - a.completed)
    .slice(0, 5);
  return {
    current,
    previous,
    rating: {
      count: ratings.count,
      average: ratings.count
        ? Math.round(((ratings["review.rating"] || 0) / ratings.count) * 10) /
          10
        : null,
    },
    topServices: top,
  };
}

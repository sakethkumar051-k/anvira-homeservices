import { z } from "zod";
import { fail } from "./errors.mjs";
export const selectionSchema = z.object({
  packageId: z.string().max(40).optional(),
  options: z.record(z.string().max(40), z.string().max(40)).default({}),
  addons: z.array(z.string().max(40)).max(10).default([]),
});
// Shared authority for quotes, checkout and capacity calculations.
export function serviceSelection(service, input) {
  const v = selectionSchema.parse(input);
  const pack = v.packageId
    ? (service.packages || []).find((p) => p.id === v.packageId)
    : null;
  if (v.packageId && !pack)
    fail(400, "Choose an available package.", "INVALID_PACKAGE");
  if (
    new Set(v.addons).size !== v.addons.length ||
    v.addons.some((id) => !service.addons.some((a) => a.id === id))
  )
    fail(400, "Invalid add-ons.", "INVALID_ADDONS");
  const groups = service.optionGroups || [],
    choices = [];
  if (Object.keys(v.options).some((id) => !groups.some((g) => g.id === id)))
    fail(400, "Choose valid service options.", "INVALID_OPTIONS");
  for (const g of groups) {
    const choice = g.options.find((o) => o.id === v.options[g.id]);
    if ((g.required || v.options[g.id]) && !choice)
      fail(400, "Choose an option for " + g.name + ".", "INVALID_OPTIONS");
    if (choice) choices.push({ group: g.name, ...choice });
  }
  const addons = service.addons.filter((a) => v.addons.includes(a.id));
  const price = pack?.price ?? service.price;
  const duration =
    (pack?.duration ?? service.duration) +
    choices.reduce((n, o) => n + o.duration, 0);
  const subtotal =
    price +
    choices.reduce((n, o) => n + o.price, 0) +
    addons.reduce((n, a) => n + a.price, 0);
  if (duration > 240 || subtotal > 100000)
    fail(
      400,
      "This combination exceeds the service limit. Choose fewer extras.",
      "SELECTION_LIMIT",
    );
  return {
    price,
    duration,
    subtotal,
    addons,
    choices,
    packageName: pack?.name || "",
    packageId: pack?.id || "",
    options: v.options,
    scope: pack?.includes?.length ? pack.includes : service.includes,
  };
}

export const detailsSchema = z
  .record(z.string().max(40), z.string().trim().max(300))
  .default({});
export function serviceDetails(service, input) {
  const details = detailsSchema.parse(input),
    fields = service.bookingFields || [];
  if (Object.keys(details).some((id) => !fields.some((f) => f.id === id)))
    fail(
      400,
      "Enter details for the current service only.",
      "INVALID_SERVICE_DETAILS",
    );
  return fields.flatMap((f) => {
    const value = details[f.id] || "";
    if (f.required && value.length < 2)
      fail(400, "Enter " + f.label + ".", "MISSING_SERVICE_DETAILS");
    return value ? [{ id: f.id, label: f.label, value }] : [];
  });
}

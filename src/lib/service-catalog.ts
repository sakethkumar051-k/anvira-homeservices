import type { Service } from "./model";
export type CatalogSort = "recommended" | "price_low" | "price_high";
export function servicePricing(
  service: Pick<
    Service,
    | "price"
    | "duration"
    | "packages"
    | "packageRequired"
    | "optionGroups"
    | "bookingMode"
    | "priceUnit"
  >,
) {
  const quoteOnly = service.bookingMode === "quote";
  const bases = [
    ...(!service.packageRequired
      ? [{ price: service.price, duration: service.duration }]
      : []),
    ...(service.packages || []),
  ];
  // Track the cheapest combination at each valid duration. Optional extras can
  // be skipped; every required group must contribute one published choice.
  let costs = new Map<number, number>();
  for (const base of bases) {
    if (
      Number.isFinite(base.price) &&
      base.price > 0 &&
      base.price <= 100000 &&
      Number.isFinite(base.duration) &&
      base.duration <= 240 &&
      base.duration >= 30
    )
      costs.set(
        base.duration,
        Math.min(costs.get(base.duration) ?? Infinity, base.price),
      );
  }
  for (const group of (service.optionGroups || []).filter(
    (group) => group.required,
  )) {
    const next = new Map<number, number>();
    for (const [duration, price] of costs)
      for (const option of group.options) {
        const time = duration + option.duration,
          total = price + option.price;
        if (
          time <= 240 &&
          total <= 100000 &&
          Number.isFinite(time) &&
          Number.isFinite(total)
        )
          next.set(time, Math.min(next.get(time) ?? Infinity, total));
      }
    costs = next;
  }
  return {
    minimum: quoteOnly || !costs.size ? null : Math.min(...costs.values()),
    from:
      !!service.packages?.length ||
      !!service.optionGroups?.some((g) => g.required),
    quoteOnly,
    unit: service.priceUnit?.trim() || "",
  };
}
export function serviceCategories(services: Service[]): string[] {
  const labels = new Map<string, string>();
  for (const s of services.filter((s) => s.active)) {
    const value = s.category.trim();
    if (value && !labels.has(value.toLocaleLowerCase()))
      labels.set(value.toLocaleLowerCase(), value);
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}
export function filterServices(
  services: Service[],
  filters: { query?: string; category?: string; sort?: CatalogSort },
): Service[] {
  const query = filters.query?.trim().toLocaleLowerCase() || "";
  const category = filters.category?.trim().toLocaleLowerCase() || "";
  return services
    .filter(
      (s) =>
        s.active &&
        (!category || s.category.trim().toLocaleLowerCase() === category) &&
        (!query ||
          [
            s.name,
            s.nameTe,
            s.category,
            s.description,
            ...(s.packages || []).map((p) => p.name),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    )
    .sort((a, b) => {
      if (filters.sort === "price_low" || filters.sort === "price_high") {
        const x = servicePricing(a).minimum,
          y = servicePricing(b).minimum;
        if (x === null && y !== null) return 1;
        if (y === null && x !== null) return -1;
        if (x !== null && y !== null && x !== y)
          return filters.sort === "price_low" ? x - y : y - x;
      }
      return (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name);
    });
}
export function selectionProblem(
  service: Service,
  packageId: string,
  options: Record<string, string>,
  details: Record<string, string>,
): string {
  if (service.bookingMode === "quote")
    return "Request a tailored quote before booking this service.";
  if (service.packageRequired && !packageId)
    return "Choose a package for this service.";
  if (packageId && !service.packages?.some((p) => p.id === packageId))
    return "Choose an available package.";
  for (const g of service.optionGroups || []) {
    if (
      (g.required || options[g.id]) &&
      !g.options.some((o) => o.id === options[g.id])
    )
      return "Choose an option for " + g.name + ".";
  }
  for (const f of service.bookingFields || [])
    if (f.required && (details[f.id] || "").trim().length < 2)
      return "Enter " + f.label + ".";
  return "";
}

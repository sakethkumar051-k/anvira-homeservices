import type { Service } from "./model";

export const mainServiceCategories = [
  {
    id: "home",
    name: "Home cleaning",
    icon: "spark",
    note: "A fresh start for every room",
  },
  {
    id: "car",
    name: "Car Care",
    icon: "spark",
    note: "Monthly subscription",
  },
  { id: "ac", name: "AC repair", icon: "air", note: "Bring the comfort back" },
  {
    id: "ro",
    name: "RO filter",
    icon: "water",
    note: "Care for your drinking water",
  },
  {
    id: "plumbing",
    name: "Plumbing",
    icon: "tool",
    note: "Help with leaks and everyday repairs",
  },
  {
    id: "electrical",
    name: "Electrician",
    icon: "bolt",
    note: "Lights, fans and fixes",
  },
] as const;
export type MainServiceCategory = (typeof mainServiceCategories)[number]["id"];

export function serviceCategoryKey(
  service: Pick<Service, "id" | "name" | "category">,
): MainServiceCategory | "other" {
  const text = [service.id, service.name, service.category]
    .join(" ")
    .toLowerCase();
  if (
    /\b(laundry|dry[- ]?clean\w*|commercial|office|beauty|makeup|salon|paint\w*|handyman)\b/.test(
      text,
    )
  )
    return "other";
  if (/\bro\b|purifier|water filter/.test(text)) return "ro";
  if (/\bcar\b|vehicle/.test(text)) return "car";
  if (/\bac\b|air condition|cooling/.test(text)) return "ac";
  if (/plumb|tap|drain|\bpipe\b/.test(text)) return "plumbing";
  if (/electric|wiring|switch|socket|ceiling fan|fan repair/.test(text)) return "electrical";
  if (/clean|sofa|bathroom|kitchen/.test(text)) return "home";
  return "other";
}

export function categoryServices(
  services: Service[],
  category: MainServiceCategory,
) {
  return services.filter(
    (service) => service.active && serviceCategoryKey(service) === category,
  );
}

export function serviceDurationText(service: Service) {
  if (service.billingPeriod === "monthly") return "Schedule agreed with the team";
  if (service.bookingMode === "quote") return "Scope confirmed before payment";
  const durations = service.packageRequired
    ? (service.packages || []).map((pack) => pack.duration)
    : [
        service.duration,
        ...(service.packages || []).map((pack) => pack.duration),
      ];
  const valid = durations.filter(
    (duration) => Number.isFinite(duration) && duration > 0,
  );
  if (!valid.length) return "Duration confirmed with your package";
  if (
    service.optionGroups?.some((group) =>
      group.options.some((option) => option.duration),
    )
  )
    return "Duration depends on your selections";
  const min = Math.min(...valid),
    max = Math.max(...valid);
  return min === max ? `${min} min` : `${min}–${max} min`;
}

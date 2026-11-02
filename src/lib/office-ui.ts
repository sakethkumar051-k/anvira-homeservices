const ownerNavigation = [
  ["home", "Overview", "grid"],
  ["bookings", "Orders & dispatch", "calendar"],
  ["quotes", "Quote requests", "tool"],
  ["workers", "Internal workers", "users"],
  ["vendors", "Professionals", "users"],
  ["services", "Services", "tool"],
  ["refunds", "Payments & refunds", "wallet"],
  ["support", "Customer support", "phone"],
  ["reports", "Reports", "chart"],
  ["settings", "Roles & settings", "settings"],
  ["payouts", "Payouts & reconciliation", "wallet"],
  ["offers", "Offers", "spark"],
];
const operationalTabs = new Set([
  "home",
  "bookings",
  "quotes",
  "workers",
  "refunds",
  "support",
]);
export function staffNavigation(role: string, platform: string) {
  if (role !== "owner" && role !== "care") return [];
  return role === "owner" && platform === "web"
    ? ownerNavigation
    : ownerNavigation.filter(([key]) => operationalTabs.has(key));
}
export function validateServiceBasics(form: {
  name: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  includes: string[];
}) {
  if (form.name.trim().length < 3 || form.name.trim().length > 100)
    return "Enter a service name with 3–100 characters.";
  if (form.category.trim().length < 2 || form.category.trim().length > 40)
    return "Enter a category with 2–40 characters.";
  if (
    form.description.trim().length < 10 ||
    form.description.trim().length > 1000
  )
    return "Describe the service in 10–1,000 characters.";
  if (!Number.isInteger(form.price) || form.price < 1 || form.price > 100000)
    return "Enter a whole-rupee base price between ₹1 and ₹1,00,000.";
  if (
    !Number.isInteger(form.duration) ||
    form.duration < 30 ||
    form.duration > 240 ||
    form.duration % 30 !== 0
  )
    return "Choose a duration between 30 and 240 minutes, in 30-minute steps.";
  const included = form.includes.map((item) => item.trim()).filter(Boolean);
  if (
    !included.length ||
    included.length > 10 ||
    included.some((item) => item.length > 200)
  )
    return "Add 1–10 included tasks, each up to 200 characters.";
  return "";
}
export type WorkerForm = {
  name: string;
  phone?: string;
  skills: string[];
  pins: string;
  active?: boolean;
  available?: boolean;
  days: number[];
  hours: number[];
  blockedDates?: string;
};
export function workerFormPayload(form: WorkerForm) {
  const name = form.name.trim(),
    pins = [
      ...new Set(
        form.pins
          .split(",")
          .map((pin) => pin.trim())
          .filter(Boolean),
      ),
    ];
  if (name.length < 2 || name.length > 100)
    throw new Error("Enter a worker name with 2–100 characters.");
  if (!form.skills.length)
    throw new Error("Choose at least one service for this worker.");
  if (!pins.length || pins.some((pin) => !/^[1-9]\d{5}$/.test(pin)))
    throw new Error(
      "Enter valid six-digit service PIN codes, separated by commas.",
    );
  if (!form.days.length || !form.hours.length)
    throw new Error("Choose at least one working day and start time.");
  const blockedDates = (form.blockedDates || "")
    .split(",")
    .map((day) => day.trim())
    .filter(Boolean);
  if (
    blockedDates.some(
      (day) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day)) ||
        new Date(day).toISOString().slice(0, 10) !== day,
    )
  )
    throw new Error(
      "Use valid YYYY-MM-DD dates for leave, separated by commas.",
    );
  if (form.phone && !/^\+?[\d\s-]{7,20}$/.test(form.phone.trim()))
    throw new Error("Enter a valid office contact number, or leave it blank.");
  return {
    name,
    phone: form.phone?.trim() || "",
    skills: form.skills,
    pins,
    active: form.active ?? true,
    available: form.available ?? true,
    schedule: { days: form.days, hours: form.hours, blockedDates },
  };
}

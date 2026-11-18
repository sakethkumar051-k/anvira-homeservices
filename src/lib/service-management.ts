export function validateServiceConfiguration(value: {
  active?: boolean;
  bookingMode?: "instant" | "quote";
  packageRequired?: boolean;
  packages?: { id: string; includes?: string[] }[];
}) {
  if (!value.active || value.bookingMode === "quote" || !value.packageRequired)
    return "";
  if (!value.packages?.length)
    return "Add at least one package, or allow the standard service.";
  if (value.packages.some((p) => !p.includes?.some((line) => line.trim())))
    return "Describe the included work for every required package.";
  return "";
}
export function ownerSetupProgress(value: {
  services: { active: boolean; sample?: boolean; sampleReviewed?: boolean }[];
  staff: { role: string; active: boolean }[];
  settings: { pins: string[] };
  professionals: {
    accountless?: boolean;
    active?: boolean;
    skills?: string[];
    pins?: string[];
  }[];
}) {
  return [
    value.services.some((s) => s.active && (!s.sample || s.sampleReviewed)),
    value.settings.pins.length > 0,
    value.professionals.some(
      (p) =>
        p.accountless &&
        p.active !== false &&
        !!p.skills?.length &&
        !!p.pins?.length,
    ),
    value.staff.some((s) => s.role === "care" && s.active),
  ];
}

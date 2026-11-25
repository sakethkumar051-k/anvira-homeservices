export function quoteValidation(input: {
  service?: {
    active: boolean;
    bookingFields?: { id: string; label: string; required?: boolean }[];
  };
  description: string;
  line: string;
  pin: string;
  allowedPins: string[];
  details: Record<string, string>;
}) {
  const errors: Record<string, string> = {};
  if (!input.service?.active) errors.service = "Choose an available service.";
  const description = input.description.trim();
  if (description.length < 15 || description.length > 2000)
    errors.description = "Describe your requirement in 15–2,000 characters.";
  for (const field of input.service?.bookingFields || []) {
    const value = (input.details[field.id] || "").trim();
    if (field.required && value.length < 2)
      errors[field.id] = "Enter " + field.label + " (at least 2 characters).";
    else if (value.length > 300)
      errors[field.id] = "Use no more than 300 characters.";
  }
  const line = input.line.trim(),
    pin = input.pin.trim();
  if (line.length < 8 || line.length > 300)
    errors.line = "Enter your full service address in 8–300 characters.";
  if (!/^\d{6}$/.test(pin)) errors.pin = "Enter a valid 6-digit PIN code.";
  else if (!input.allowedPins.includes(pin))
    errors.pin = "This service is unavailable for that PIN code.";
  return errors;
}

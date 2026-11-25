// Existing Car Care records predate the billing-period field.
export function serviceOffering(service) {
  if (!service) return service;
  if (service.billingPeriod === "monthly")
    return { ...service, bookingMode: "quote" };
  if (
    service.billingPeriod ||
    !["car-cleaning", "review-car-cleaning"].includes(service.id)
  )
    return service;
  return {
    ...service,
    billingPeriod: "monthly",
    bookingMode: "quote",
    name: "Monthly Car Care",
    nameTe: "నెలవారీ కారు సంరక్షణ",
    category: "Car Care",
    headline: "Regular car cleaning at your parking spot",
    description:
      "Keep your car clean with a monthly plan. Tell us your car model, parking location and preferred days. The team will confirm the visits included, schedule and monthly price before you subscribe.",
    descriptionTe:
      "నెలవారీ ప్లాన్‌తో మీ కారును శుభ్రంగా ఉంచుకోండి. మీ కారు మోడల్, పార్కింగ్ స్థలం, మీకు అనుకూలమైన రోజులు చెప్పండి. మీరు సభ్యత్వం తీసుకునే ముందు ఎన్ని సార్లు శుభ్రం చేస్తాం, ఎప్పుడు వస్తాం, నెలకు ఎంత ఖర్చవుతుంది అనే వివరాలను మా బృందం నిర్ధారిస్తుంది.",
    includes: [
      "Car cleaning at your parking spot as agreed in your monthly plan",
    ],
    excludes: ["Repairs, scratch removal and work outside the agreed plan"],
    preparation: ["Make sure the team can access your car at the agreed time."],
    faqs: [
      {
        question: "How many cleaning visits are included?",
        answer:
          "The team will confirm how often we visit, the work included and the monthly price for your location.",
      },
    ],
    price: 0,
    priceUnit: "",
    packageRequired: false,
    packages: [],
    addons: [],
    optionGroups: [],
    checklist: [],
    warranty: "",
    bookingFields: [
      {
        id: "vehicle",
        label: "Car make and model",
        placeholder: "Example: Maruti Swift",
        help: "",
        required: true,
      },
      {
        id: "parking",
        label: "Parking instructions",
        placeholder: "Example: basement B2, bay 14",
        help: "Enter a safe, accessible parking location. No registration number is needed.",
        required: true,
      },
    ],
  };
}

export function isMonthlyQuote(quote, service) {
  return (
    quote.billingPeriod === "monthly" ||
    serviceOffering(service)?.billingPeriod === "monthly"
  );
}

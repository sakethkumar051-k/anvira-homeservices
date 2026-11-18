// Public enquiry categories. Quotes and availability are confirmed by the office;
// fictional prices in the local app catalog are never advertised here.
export const marketingServices = [
  {
    id: "home",
    category: "Cleaning",
    name: "Home cleaning",
    te: "ఇంటి శుభ్రత",
    description:
      "A fresh start for every room, from the kitchen to the whole home.",
    detail:
      "Choose whole-home deep cleaning, kitchen care, bathroom cleaning or sofa care. Share the home size, surfaces and access needs; we confirm supplies, drying guidance, scope and price before the visit.",
    price: "Choose your cleaning plan",
    image: "cleaning",
  },
  {
    id: "car",
    category: "Cleaning",
    name: "Car cleaning",
    te: "కార్ క్లీనింగ్",
    description:
      "Exterior washes, interior care and a clean car at your doorstep.",
    detail:
      "Choose an exterior wash, inside-and-out clean or interior detail. Tell us your vehicle size, parking location and water access. Ask the office about recurring care and confirm the included visits before starting.",
    price: "Exterior & interior care",
    image: "car",
  },
  {
    id: "ac",
    category: "Repairs",
    name: "AC repair & service",
    te: "ఏసీ రిపేర్ & సర్వీస్",
    description:
      "Cooling issues, routine cleaning and repairs explained before work begins.",
    detail:
      "Choose a repair diagnosis, routine AC service or deep clean. Share your AC type and symptoms; repair labour, refrigerant and replacement parts are quoted separately for approval.",
    price: "Service, diagnosis & repairs",
    image: "ac",
  },
  {
    id: "ro",
    category: "Repairs",
    name: "RO filter service",
    te: "ఆర్ఓ ఫిల్టర్ సర్వీస్",
    description:
      "Purifier maintenance, filter changes and help with leaks or slow flow.",
    detail:
      "Choose routine purifier service, filter-replacement labour or installation. Share your purifier brand and model. Compatible filters, membrane and spare parts are confirmed and quoted separately; maintenance does not replace laboratory water testing.",
    price: "Purifier & filter care",
    image: "ro",
  },
  {
    id: "plumbing",
    category: "Repairs",
    name: "Plumbing",
    te: "ప్లంబింగ్",
    description:
      "Help for leaky taps, slow drains and everyday plumbing problems.",
    detail:
      "Choose a plumbing diagnosis, tap fitting or accessible sink-drain clearing. Describe the issue; replacement parts, concealed pipes and major work require an agreed quote before proceeding.",
    price: "Leaks, taps & drains",
    image: "plumbing",
  },
  {
    id: "electrical",
    category: "Repairs",
    name: "Electrician",
    te: "ఎలక్ట్రీషియన్",
    description:
      "Care for lights, switches, fans and household electrical faults.",
    detail:
      "Choose fault diagnosis, switch or socket replacement, or ceiling-fan fitting. The office confirms a suitable professional and explains labour and materials before work begins. For smoke or fire, keep clear and contact emergency services.",
    price: "Lights, switches & fans",
    image: "electrical",
  },
] as const;
export type MarketingService = (typeof marketingServices)[number];

// Public marketing copy approved in the client's brief. These are enquiry
// categories, not automatically published bookable services or sample prices.
export const marketingServices = [
  {
    id: "car",
    category: "Everyday",
    name: "Doorstep car cleaning",
    te: "ఇంటి వద్ద కార్ క్లీనింగ్",
    description:
      "A clean car, without a trip to the car wash. Ask about monthly care at your home.",
    detail:
      "Tell us your vehicle size, parking location and preferred days. We’ll confirm the included visits, water access and exact scope before you start.",
    price: "From ₹500 / month",
    image: "car",
  },
  {
    id: "laundry",
    category: "Everyday",
    name: "Laundry & dry cleaning",
    te: "లాండ్రీ & డ్రై క్లీనింగ్",
    description:
      "We pick it up. We bring it back. Fresh clothes with less running around.",
    detail:
      "Share the garments and your pickup address. We’ll confirm garment-wise pricing, fabric care, collection and delivery time before pickup.",
    price: "Pickup & delivery",
    image: "laundry",
  },
  {
    id: "home",
    category: "Cleaning",
    name: "Home cleaning",
    te: "ఇంటి శుభ్రత",
    description:
      "From your kitchen to the whole home. Tell us what needs a fresh start.",
    detail:
      "Choose the rooms and areas you need cleaned. We’ll agree the scope, supplies, preparation and price before the visit.",
    price: "Made for your home",
    image: "cleaning",
  },
  {
    id: "commercial",
    category: "Cleaning",
    name: "Commercial cleaning",
    te: "ఆఫీస్ & షాప్ క్లీనింగ్",
    description: "A cleaner workplace for offices, shops and shared spaces.",
    detail:
      "Tell us your floor area, business hours and cleaning frequency. We’ll plan work around your team and confirm a tailored quote.",
    price: "Ask for a tailored quote",
    image: "commercial",
  },
  {
    id: "ac",
    category: "Repairs",
    name: "AC service & repair",
    te: "ఏసీ సర్వీస్ & రిపేర్",
    description:
      "Keep cool. Get help with cleaning, cooling issues and repairs.",
    detail:
      "Share the AC type and issue. Diagnosis, cleaning and any proposed parts or gas charges will be explained before additional work.",
    price: "Tell us what needs fixing",
    image: "ac",
  },
  {
    id: "plumbing",
    category: "Repairs",
    name: "Plumbing",
    te: "ప్లంబింగ్",
    description:
      "Leaky taps, blocked drains and everyday plumbing problems, sorted.",
    detail:
      "Describe the issue and share a photo if useful. The team will explain the work and any required replacement parts before proceeding.",
    price: "Help for everyday repairs",
    image: "plumbing",
  },
  {
    id: "electrical",
    category: "Repairs",
    name: "Electrical services",
    te: "ఎలక్ట్రికల్ సర్వీసులు",
    description:
      "Help with lights, switches, fans and electrical faults at home.",
    detail:
      "Tell us the fitting or fault that needs attention. Repair scope and materials will be discussed before the job. For an electrical emergency, switch off the affected supply safely.",
    price: "Discuss your requirement",
    image: "electrical",
  },
  {
    id: "beauty",
    category: "Personal care",
    name: "Makeup & beauty",
    te: "మేకప్ & బ్యూటీ",
    description:
      "A little time for yourself. Beauty and occasion-ready makeup at home.",
    detail:
      "Tell us the treatment or occasion, date and any skin sensitivities. We’ll confirm the available professional, products and quote.",
    price: "Care, on your schedule",
    image: "beauty",
  },
  {
    id: "sofa",
    category: "Cleaning",
    name: "Sofa cleaning",
    te: "సోఫా క్లీనింగ్",
    description:
      "Freshen up the favourite seat in your home with fabric-aware care.",
    detail:
      "Share the seat count, fabric and any stains. We’ll confirm the method, drying guidance and price. Some stains may not be removable.",
    price: "Tell us your sofa size",
    image: "sofa",
  },
] as const;
export type MarketingService = (typeof marketingServices)[number];

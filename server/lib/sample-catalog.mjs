// Fictional INR prices and scopes for product demonstrations, never launch offers.
const option = (id, name, price = 0, duration = 0) => ({
  id,
  name,
  price,
  duration,
});
const group = (id, name, options, required = true) => ({
  id,
  name,
  options,
  required,
});
const field = (id, label, placeholder, required = false, help = "") => ({
  id,
  label,
  placeholder,
  required,
  help,
});
const pack = (id, name, price, duration, includes, description) => ({
  id,
  name,
  price,
  duration,
  includes,
  description,
});
const faq = (question, answer) => ({ question, answer });
const common = {
  active: true,
  sample: true,
  nameTe: "",
  descriptionTe: "",
  warranty:
    "Demo policy: raise a service-quality concern from your booking. Support reviews the scope and proposes a resolution; a free revisit is not automatically guaranteed. The business must approve real warranty terms before launch.",
};
export const sampleServices = [
  {
    id: "cleaning",
    name: "Home deep cleaning",
    nameTe: "ఇంటి డీప్ క్లీనింగ్",
    category: "Cleaning",
    icon: "spark",
    price: 1499,
    duration: 180,
    headline: "A fresh start for your home",
    description:
      "A sample deep clean for an occupied 1-bedroom home, covering accessible floors, kitchen surfaces and one bathroom. Choose a package for a larger home or a focused kitchen clean.",
    includes: [
      "Accessible floors swept and mopped",
      "Kitchen counters and cabinet exteriors",
      "One bathroom cleaned and descaled",
      "Standard cleaning supplies and tidy finish",
    ],
    excludes: [
      "Moving heavy furniture",
      "Inside appliances or locked cupboards",
      "Pest treatment, paint removal and restoration",
    ],
    addons: [{ id: "extra", name: "One additional bathroom", price: 399 }],
    packages: [
      pack(
        "kitchen-care",
        "Kitchen focus",
        1299,
        120,
        [
          "Countertops and sink",
          "Cabinet exteriors",
          "Accessible wall-tile degreasing",
        ],
        "A focused kitchen clean; appliance interiors are excluded.",
      ),
      pack(
        "premium-home",
        "Premium home care",
        2499,
        210,
        [
          "Up to 2 bedrooms and living area",
          "Kitchen surface clean",
          "Up to 2 bathrooms",
          "Customer walkthrough",
        ],
        "An extended clean for an occupied 2-bedroom home.",
      ),
    ],
    optionGroups: [
      group(
        "focus",
        "Extra focus area",
        [
          option("balcony", "Balcony care", 299, 30),
          option("windows", "Window surfaces", 399, 30),
        ],
        false,
      ),
    ],
    bookingFields: [
      field(
        "home-size",
        "Home size",
        "Example: 1 bedroom, 1 bathroom",
        false,
        "Choose Premium home care if you have 2 bedrooms.",
      ),
    ],
    preparation: [
      "Store valuables and clear accessible surfaces.",
      "Provide water, electricity and access to all selected rooms.",
    ],
    checklist: ["Nearby furniture protected", "Cleaned surfaces inspected"],
    faqs: [
      faq(
        "What should I prepare?",
        "Store valuables, clear surfaces and make water and electricity available.",
      ),
      faq(
        "Are materials included?",
        "Standard cleaning products and tools are included. Restoration and specialist chemicals are excluded.",
      ),
    ],
  },
  {
    id: "car-cleaning",
    name: "Doorstep car cleaning",
    nameTe: "ఇంటి వద్ద కార్ క్లీనింగ్",
    category: "Car care",
    icon: "tool",
    price: 499,
    duration: 60,
    headline: "A cleaner car, without the queue",
    description:
      "Exterior wash and dry for one hatchback or sedan at your parking space. Select vehicle size, water access and an interior package before booking. These are fictional demo prices.",
    includes: [
      "Body wash with vehicle-safe shampoo",
      "Wheel and tyre surface cleaning",
      "Exterior glass cleaning",
      "Microfibre drying",
    ],
    excludes: [
      "Engine-bay wash",
      "Paint correction, ceramic coating or scratch removal",
      "Moving or driving your vehicle",
    ],
    packages: [
      pack(
        "inside-out",
        "Inside & out",
        899,
        90,
        [
          "Exterior wash and dry",
          "Interior vacuum",
          "Dashboard and door-panel wipe",
          "Interior glass clean",
        ],
        "Add an interior vacuum and surface clean to the exterior wash.",
      ),
      pack(
        "interior-detail",
        "Interior detail",
        1499,
        150,
        [
          "Interior vacuum",
          "Fabric-seat surface shampoo",
          "Mats and dashboard clean",
          "Customer inspection",
        ],
        "Interior only. Fabric may need 4–6 hours to dry; stain removal is not guaranteed.",
      ),
    ],
    optionGroups: [
      group("vehicle-size", "Vehicle size", [
        option("hatchback", "Hatchback / sedan"),
        option("suv", "SUV / 7-seater", 200, 30),
      ]),
      group("water", "Water access at parking", [
        option("tap", "Water tap available nearby"),
        option("waterless", "No tap — waterless exterior clean", 100),
      ]),
    ],
    addons: [{ id: "mats", name: "Rubber mat deep clean", price: 149 }],
    bookingFields: [
      field(
        "vehicle",
        "Car make and model",
        "Example: Maruti Swift",
        true,
        "Helps your professional bring the right supplies.",
      ),
      field(
        "parking",
        "Parking instructions",
        "Example: basement B2, bay 14",
        true,
        "Enter a safe, accessible parking location. No registration number is needed.",
      ),
    ],
    preparation: [
      "Park in a safe, accessible space and obtain apartment permission.",
      "Remove valuables from the cabin; keep your keys with you.",
      "For a wet wash, provide nearby water and drainage.",
    ],
    checklist: [
      "Vehicle condition discussed before cleaning",
      "Selected exterior or interior scope completed",
      "Glass and surfaces inspected with customer",
    ],
    faqs: [
      faq(
        "Is water required?",
        "Choose Water tap available for a wet wash, or the waterless option if no tap is available. The professional confirms suitability for heavy mud.",
      ),
      faq(
        "Will you remove every stain or scratch?",
        "No. Existing scratches and permanent stains are outside scope. Additional work requires your approval.",
      ),
    ],
  },
  {
    id: "ac",
    name: "AC service & repair",
    nameTe: "ఏసీ సర్వీస్",
    category: "AC",
    icon: "air",
    price: 599,
    duration: 90,
    headline: "Comfort, restored.",
    description:
      "Routine cleaning of one domestic AC: filter, accessible coil and drain check. A repair diagnosis package covers inspection only; spare parts, gas refill and repair labour need a separate approved quote.",
    includes: [
      "Filter cleaning",
      "Accessible indoor-coil cleaning",
      "Drain and cooling checks",
    ],
    excludes: [
      "Refrigerant refill",
      "Spare parts and major repair labour",
      "Unsafe outdoor-unit access",
    ],
    addons: [
      { id: "extra", name: "One additional AC filter clean", price: 399 },
    ],
    packages: [
      pack(
        "diagnosis",
        "Repair diagnosis only",
        299,
        60,
        ["Fault inspection", "Written repair recommendation"],
        "Inspection fee only. Approve a separate quote before any repair.",
      ),
      pack(
        "deep-ac",
        "Deep AC clean",
        999,
        120,
        ["Indoor-unit deep clean", "Filter and drain clean", "Cooling test"],
        "Detailed cleaning; does not include gas refill or repairs.",
      ),
    ],
    optionGroups: [
      group(
        "ac-type",
        "AC type",
        [option("split", "Split AC"), option("window", "Window AC")],
        false,
      ),
    ],
    bookingFields: [
      field(
        "symptom",
        "AC brand and concern",
        "Example: LG split AC, not cooling",
      ),
    ],
    preparation: [
      "Clear space below the indoor unit.",
      "Provide safe unit access and electricity.",
    ],
    checklist: ["Filter and drain inspected", "Cooling test explained"],
    faqs: [
      faq(
        "Does the price include gas refill?",
        "No. Refrigerant and parts are quoted separately after diagnosis and require your approval.",
      ),
    ],
  },
  {
    id: "plumbing",
    name: "Plumbing repair",
    nameTe: "ప్లంబింగ్ మరమ్మతులు",
    category: "Plumbing",
    icon: "water",
    price: 299,
    duration: 60,
    headline: "Small fixes. Lasting comfort.",
    description:
      "Visit and diagnosis for one accessible plumbing issue. The ₹299 sample inspection fee excludes repair labour and parts; the professional provides a quote for approval before proceeding.",
    includes: [
      "Inspect one reported issue",
      "Explain the cause and repair options",
      "Provide a parts and labour quote",
    ],
    excludes: [
      "Replacement parts",
      "Repair labour beyond diagnosis",
      "Concealed pipe or civil work",
    ],
    addons: [],
    packages: [
      pack(
        "tap-fit",
        "Fit a customer-supplied tap",
        499,
        60,
        [
          "Remove one accessible tap",
          "Fit compatible customer-supplied tap",
          "Leak test",
        ],
        "Fixed fitting labour for one tap. Tap, adapters and concealed pipework excluded.",
      ),
    ],
    optionGroups: [
      group(
        "issue",
        "What needs attention?",
        [
          option("tap", "Tap / shower"),
          option("leak", "Visible pipe leak"),
          option("drain", "Slow drain"),
        ],
        false,
      ),
    ],
    bookingFields: [
      field(
        "issue-location",
        "Where is the issue?",
        "Example: kitchen sink dripping",
      ),
    ],
    preparation: [
      "Locate the water shut-off valve.",
      "Clear access to the affected fixture.",
    ],
    checklist: [
      "Issue and approved scope explained",
      "Leak or flow test completed",
    ],
    faqs: [
      faq(
        "Is ₹299 the full repair price?",
        "No. It is a visit and diagnosis fee. Parts and repair labour need a separate quote. Tap-fitting has its own fixed labour package.",
      ),
    ],
  },
  {
    id: "electrical",
    name: "Electrical repair",
    nameTe: "ఎలక్ట్రికల్ మరమ్మతులు",
    category: "Electrical",
    icon: "bolt",
    price: 299,
    duration: 60,
    headline: "Safe hands for your home",
    description:
      "Visit and fault diagnosis for one household electrical issue. The sample inspection fee excludes parts and repair labour. Turn off the circuit and contact emergency services for smoke or fire.",
    includes: [
      "Inspect one household fault",
      "Explain safe repair options",
      "Provide a parts and labour quote",
    ],
    excludes: [
      "Replacement parts",
      "Major rewiring",
      "Emergency fire response",
    ],
    addons: [],
    packages: [
      pack(
        "fan-fit",
        "Fit one ceiling fan",
        599,
        90,
        [
          "Fit a compatible customer-supplied fan",
          "Check mounting and wiring",
          "Function test",
        ],
        "Labour only on an existing safe mounting point; new wiring is excluded.",
      ),
    ],
    optionGroups: [
      group(
        "fault",
        "Electrical issue",
        [
          option("switch", "Switch / socket"),
          option("light", "Light / fan"),
          option("trip", "Circuit tripping"),
        ],
        false,
      ),
    ],
    bookingFields: [
      field(
        "fault-detail",
        "Describe the fault",
        "Example: bedroom fan not running",
      ),
    ],
    preparation: [
      "Keep children away from affected points.",
      "Provide access to the main electrical panel.",
    ],
    checklist: ["Circuit safety checked", "Approved work function-tested"],
    faqs: [
      faq(
        "Do you supply replacement parts?",
        "Parts are not included in the inspection fee. The professional asks for approval before purchasing or fitting them.",
      ),
    ],
  },
  {
    id: "painting",
    name: "Painting consultation",
    nameTe: "పెయింటింగ్ కన్సల్టేషన్",
    category: "Painting",
    icon: "roller",
    price: 199,
    duration: 60,
    headline: "Make room for a new look",
    description:
      "A site visit to measure up to three rooms, inspect walls and prepare a painting estimate. The consultation fee does not include painting labour, paint or civil repairs.",
    includes: [
      "Room measurement",
      "Surface condition check",
      "Colour and finish discussion",
      "Written estimate",
    ],
    excludes: [
      "Paint and painting labour",
      "Waterproofing and civil repairs",
      "Scaffolding",
    ],
    addons: [],
    packages: [],
    optionGroups: [
      group(
        "scope",
        "Area to estimate",
        [
          option("room", "One room"),
          option("home", "Up to three rooms"),
          option("exterior", "Accessible exterior"),
        ],
        false,
      ),
    ],
    bookingFields: [
      field(
        "rooms",
        "Rooms and approximate size",
        "Example: 2 bedrooms, 10 × 12 feet",
      ),
    ],
    preparation: [
      "Make walls accessible for inspection.",
      "Tell us about damp patches and previous leaks.",
    ],
    checklist: ["Measurements recorded", "Estimate and exclusions explained"],
    faqs: [
      faq(
        "Can you paint during this visit?",
        "This booking is a consultation only. Painting requires an approved separate quotation and schedule.",
      ),
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom deep cleaning",
    nameTe: "బాత్రూమ్ డీప్ క్లీనింగ్",
    category: "Bathroom",
    icon: "water",
    price: 699,
    duration: 90,
    headline: "A brighter bathroom, every day",
    description:
      "Deep cleaning for one standard bathroom up to 60 sq ft. Accessible tiles, toilet, sink and fixtures are cleaned with suitable products; permanent stains and damaged grout may remain.",
    includes: [
      "Toilet and basin clean",
      "Accessible tile descaling",
      "Fixture and mirror clean",
      "Floor clean",
    ],
    excludes: [
      "Grout replacement",
      "Permanent stain restoration",
      "Plumbing repairs",
    ],
    addons: [{ id: "second", name: "Second standard bathroom", price: 599 }],
    packages: [],
    optionGroups: [
      group("size", "Bathroom size", [
        option("standard", "Up to 60 sq ft"),
        option("large", "61–100 sq ft", 200, 30),
      ]),
    ],
    bookingFields: [
      field(
        "material",
        "Special surfaces (optional)",
        "Example: marble countertop",
        false,
        "Helps us choose safe cleaning products.",
      ),
    ],
    preparation: [
      "Remove toiletries and floor mats.",
      "Provide water and ventilation.",
    ],
    checklist: [
      "Surface compatibility checked",
      "Fixtures and floor inspected",
    ],
    faqs: [
      faq(
        "Will old stains disappear?",
        "Results depend on the surface condition. Permanent stains, damaged grout and corrosion are excluded.",
      ),
    ],
  },
  {
    id: "sofa",
    name: "Sofa & upholstery cleaning",
    nameTe: "సోఫా క్లీనింగ్",
    category: "Sofa care",
    icon: "spark",
    price: 899,
    duration: 90,
    headline: "Refresh your favourite seat",
    description:
      "Vacuum and fabric shampoo for a 3-seat fabric sofa. Pick the seating size and fabric type. A spot test comes first; fabric needs time to dry after cleaning.",
    includes: [
      "Fabric compatibility spot test",
      "Dry vacuum",
      "Fabric shampoo and extraction",
    ],
    excludes: [
      "Leather conditioning",
      "Fabric repair",
      "Guaranteed stain or odour removal",
    ],
    addons: [{ id: "cushions", name: "Two loose cushion covers", price: 199 }],
    packages: [],
    optionGroups: [
      group("seats", "Number of seats", [
        option("three", "3 seats"),
        option("five", "5 seats", 400, 30),
        option("seven", "7 seats", 800, 60),
      ]),
    ],
    bookingFields: [
      field(
        "fabric",
        "Sofa fabric",
        "Example: polyester, cotton or unsure",
        true,
        "Leather is not included. We perform a spot test before shampooing.",
      ),
    ],
    preparation: [
      "Keep the sofa unused while it dries.",
      "Provide water, electricity and ventilation.",
    ],
    checklist: ["Spot test accepted", "Drying instructions explained"],
    faqs: [
      faq(
        "How long until I can sit on it?",
        "Allow approximately 4–8 hours, depending on fabric and ventilation. The professional confirms after cleaning.",
      ),
    ],
  },
  {
    id: "appliance",
    name: "Washing machine diagnosis",
    nameTe: "వాషింగ్ మెషిన్ తనిఖీ",
    category: "Appliances",
    icon: "tool",
    price: 349,
    duration: 60,
    headline: "Understand the fault before you repair",
    description:
      "Inspection and a repair estimate for one domestic washing machine. The sample visit fee excludes parts and repair labour; no extra work starts without your approval.",
    includes: ["Fault diagnosis", "Safety check", "Written repair estimate"],
    excludes: [
      "Parts and repair labour",
      "Manufacturer warranty service",
      "Transport to a workshop",
    ],
    addons: [],
    packages: [],
    optionGroups: [
      group("machine", "Washing machine type", [
        option("top", "Top-load"),
        option("front", "Front-load"),
        option("semi", "Semi-automatic"),
      ]),
    ],
    bookingFields: [
      field(
        "machine-brand",
        "Brand and model (if known)",
        "Example: Samsung 7 kg front-load",
        true,
      ),
      field(
        "machine-fault",
        "What is going wrong?",
        "Example: not draining, error E2",
        true,
      ),
    ],
    preparation: [
      "Unplug the machine if leaking or sparking.",
      "Keep the machine accessible without moving it yourself.",
    ],
    checklist: [
      "Fault and estimate explained",
      "Machine left safely connected or isolated",
    ],
    faqs: [
      faq(
        "Will the repair be completed today?",
        "That depends on parts and your approval of the estimate. This booking guarantees diagnosis only.",
      ),
    ],
  },
  {
    id: "handyman",
    name: "Furniture assembly",
    nameTe: "ఫర్నిచర్ అసెంబ్లీ",
    category: "Handyman",
    icon: "tool",
    price: 599,
    duration: 90,
    headline: "From flat pack to ready to use",
    description:
      "Assemble one customer-supplied small flat-pack table or chair with complete parts and instructions. Select a package for a desk or bed. Wall drilling and electrical fitting are excluded.",
    includes: [
      "Parts and instructions check",
      "Assembly of selected item",
      "Stability check and packaging tidy-up",
    ],
    excludes: [
      "Replacement hardware",
      "Wall mounting or drilling",
      "Custom carpentry",
    ],
    addons: [],
    packages: [
      pack(
        "desk",
        "Office desk assembly",
        899,
        120,
        ["One flat-pack desk assembly", "Stability check"],
        "Standard desk, up to 120 cm wide.",
      ),
      pack(
        "bed",
        "Bed-frame assembly",
        1299,
        180,
        ["One flat-pack bed frame", "Fastener and stability checks"],
        "Frame only; hydraulic storage beds are excluded.",
      ),
    ],
    optionGroups: [],
    bookingFields: [
      field(
        "item-model",
        "Furniture brand and model",
        "Example: IKEA LACK side table",
        true,
      ),
      field(
        "parts",
        "Are all parts and instructions available?",
        "Example: yes, unopened box",
        true,
      ),
    ],
    preparation: [
      "Keep the box and instructions ready.",
      "Clear floor space for safe assembly.",
    ],
    checklist: [
      "Parts checked before assembly",
      "Fasteners and stability inspected",
    ],
    faqs: [
      faq(
        "What if a part is missing?",
        "The professional will explain what is missing. Replacement parts and return visits are outside the selected assembly scope.",
      ),
    ],
  },
].map((s, order) => ({ ...common, ...s, order }));

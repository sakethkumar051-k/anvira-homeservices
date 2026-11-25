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
    name: "Home cleaning",
    nameTe: "ఇంటి డీప్ క్లీనింగ్",
    category: "Home cleaning",
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
    addons: [
      {
        id: "extra",
        name: "One additional bathroom",
        price: 399,
        duration: 30,
        packageIds: ["", "bathroom-care", "premium-home"],
      },
      {
        id: "balcony",
        name: "Balcony care",
        price: 299,
        duration: 30,
        packageIds: ["", "premium-home"],
      },
      {
        id: "windows",
        name: "Window surfaces",
        price: 399,
        duration: 30,
        packageIds: ["", "premium-home"],
      },
    ],
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
        "bathroom-care",
        "Bathroom deep cleaning",
        699,
        90,
        [
          "One bathroom's accessible tiles and fixtures",
          "Toilet and washbasin cleaning",
          "Tap and shower surface descaling",
        ],
        "One standard bathroom. Concealed blockages, tile restoration and plumbing repairs are excluded.",
      ),
      pack(
        "sofa-care",
        "Sofa & upholstery cleaning",
        999,
        120,
        [
          "Vacuum one fabric sofa up to three seats",
          "Fabric suitability check",
          "Surface shampoo and extraction where suitable",
        ],
        "Fabric upholstery only. Allow drying time; stain removal and leather restoration are not guaranteed.",
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
    optionGroups: [],
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
    category: "Car cleaning",
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
    addons: [
      {
        id: "mats",
        name: "Rubber mat deep clean",
        price: 149,
        packageIds: ["", "inside-out"],
      },
    ],
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
    category: "AC repair",
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
      {
        id: "extra",
        name: "One additional AC filter clean",
        price: 399,
        duration: 30,
        packageIds: ["", "deep-ac"],
      },
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
    id: "ro",
    name: "RO filter service",
    nameTe: "ఆర్ఓ వాటర్ ప్యూరిఫైయర్ సర్వీస్",
    category: "RO filter",
    icon: "water",
    price: 399,
    duration: 60,
    headline: "Care for your everyday drinking water",
    description:
      "Visit and inspection for one domestic RO water purifier. Check flow, visible leaks and filter condition, then review a written quote for replacement filters, membrane or repair work. All listed prices are fictional demo amounts.",
    includes: [
      "Inspect one accessible domestic RO purifier",
      "Check visible connections, leaks and water flow",
      "Explain recommended filter care and any additional quote",
    ],
    excludes: [
      "Replacement filter cartridges, membrane and spare parts",
      "Laboratory water-quality testing or a drinking-water safety guarantee",
      "Concealed plumbing and electrical repairs",
    ],
    addons: [],
    packages: [
      pack(
        "routine-care",
        "Routine purifier service",
        599,
        90,
        [
          "Inspect accessible filters and connections",
          "Clean accessible housing and exterior",
          "Flush and flow-check using the manufacturer's process",
        ],
        "Routine maintenance labour for one unit. Filter cartridges, membranes and major repairs are quoted separately.",
      ),
      pack(
        "filter-fit",
        "Filter replacement labour",
        699,
        90,
        [
          "Confirm customer-supplied filter compatibility",
          "Fit approved compatible customer-supplied cartridges",
          "Flush, check for leaks and explain the next care date",
        ],
        "Labour only; replacement cartridges and membrane are not included. The team confirms model compatibility first.",
      ),
      pack(
        "installation",
        "Purifier installation",
        899,
        120,
        [
          "Check an existing suitable water and power point",
          "Mount one compatible domestic purifier",
          "Connect, flush and test for visible leaks",
        ],
        "Installation labour only. Purifier, fittings, new plumbing, electrical points and wall restoration are excluded.",
      ),
    ],
    optionGroups: [
      group(
        "purifier-type",
        "Purifier type",
        [
          option("ro", "RO purifier"),
          option("ro-uv", "RO + UV / UF purifier"),
          option("unsure", "Help identify my purifier"),
        ],
        false,
      ),
    ],
    bookingFields: [
      field(
        "purifier-model",
        "Purifier brand and model",
        "Example: Kent Grand RO + UV",
      ),
      field(
        "water-concern",
        "What needs attention?",
        "Example: slow water flow or filter replacement",
      ),
    ],
    preparation: [
      "Keep the purifier accessible and have model details ready.",
      "Locate the inlet-water valve and the purifier's power switch.",
      "Keep the unit's service history and compatible filter packaging if available.",
    ],
    checklist: [
      "Model and approved maintenance scope confirmed",
      "Connections and visible leaks checked",
      "Flush and water-flow check explained",
    ],
    faqs: [
      faq(
        "Are replacement filters included?",
        "No. Filters, membrane and spare parts are quoted separately. We confirm compatibility and ask for approval before replacing them.",
      ),
      faq(
        "Does a TDS reading prove the water is safe?",
        "No. A basic reading does not replace suitable laboratory water testing or establish drinking-water safety.",
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
        "drain-clear",
        "Accessible sink drain clearing",
        599,
        90,
        [
          "Inspect one accessible sink trap",
          "Remove a minor accessible blockage",
          "Flow and leak test",
        ],
        "One sink only. Jetting, main sewer lines, concealed pipes and replacement parts require a separate quote.",
      ),
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
    name: "Electrician",
    nameTe: "ఎలక్ట్రికల్ మరమ్మతులు",
    category: "Electrician",
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
        "switch-fit",
        "Switch or socket replacement",
        399,
        60,
        [
          "Isolate the affected circuit",
          "Replace one compatible customer-supplied switch or socket",
          "Connection and function test",
        ],
        "Labour at one accessible existing point. Parts, new circuits and concealed wiring are excluded.",
      ),
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
].map((s, order) => ({ ...common, ...s, order }));

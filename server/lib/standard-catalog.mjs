// ANVIRA starter rate card. Published Hyderabad references and derivations:
// docs/STANDARD-SERVICE-PRICING.md. Scope is authored for ANVIRA; no UC guarantees.
export const standardTranslations = {};
const text = ([en, te]) => {
  standardTranslations[en] = te;
  return en;
};
const lines = (items) => items.map(text);
const pack = (id, name, price, duration, description, includes, excludes) => ({
  id,
  name: text(name),
  price,
  duration,
  description: text(description),
  includes: lines(includes),
  excludes: lines(excludes),
});
const extra = (id, name, price, duration, packageIds) => ({
  id,
  name: text(name),
  price,
  duration,
  packageIds,
  enabled: true,
});
const parts = [
  [
    "New parts and materials; approve their price before extra work",
    "కొత్త విడిభాగాలు, సామగ్రి ధర అదనం. అదనపు పనికి ముందు ధరకు అంగీకరించండి",
  ],
  [
    "Concealed pipework, new wiring and major repair work",
    "గోడల లోపలి పైపులు, కొత్త వైరింగ్, పెద్ద మరమ్మతులు",
  ],
];
const cleaningExclusions = [
  [
    "Paint, cement, permanent stain removal and restoration",
    "పెయింట్, సిమెంట్, శాశ్వత మరకల తొలగింపు, పునరుద్ధరణ పనులు",
  ],
  [
    "Moving heavy furniture or cleaning inaccessible areas",
    "బరువైన ఫర్నిచర్‌ను కదపడం, అందుబాటులో లేని ప్రదేశాల శుభ్రత",
  ],
];
const acExclusions = [
  [
    "Gas refill, spare parts and repairs are charged only after approval",
    "గ్యాస్ నింపడం, విడిభాగాలు, మరమ్మతులకు మీ అంగీకారం తర్వాతే అదనపు ధర",
  ],
  [
    "New copper pipe, brackets and electrical wiring",
    "కొత్త రాగి పైపులు, బ్రాకెట్లు, ఎలక్ట్రికల్ వైరింగ్",
  ],
];
const roExclusions = [
  [
    "Replacement filters, membrane, pump and other spare parts",
    "మార్చాల్సిన ఫిల్టర్లు, మెంబ్రేన్, పంపు, ఇతర విడిభాగాలు",
  ],
  [
    "Commercial purifiers, new plumbing or electrical connections",
    "వాణిజ్య వాటర్ ప్యూరిఫైయర్లు, కొత్త పైపులు లేదా విద్యుత్ కనెక్షన్లు",
  ],
];
const carExclusions = [
  [
    "Engine wash, paint correction and scratch removal",
    "ఇంజిన్ వాష్, పెయింట్ సవరణ, గీతల తొలగింపు",
  ],
  [
    "Driving the car or removing fitted seats",
    "కారును నడపడం, అమర్చిన సీట్లను తొలగించడం",
  ],
];
function service(
  id,
  name,
  category,
  icon,
  photoKey,
  description,
  priceUnit,
  packages,
  addons = [],
  preparation = [],
) {
  return {
    id,
    name: text(name),
    nameTe: name[1],
    category,
    icon,
    photoKey,
    description: text(description),
    descriptionTe: description[1],
    headline: description[0].split(".")[0],
    priceUnit: text(priceUnit),
    price: Math.min(...packages.map((p) => p.price)),
    duration: packages[0].duration,
    active: true,
    status: "active",
    sample: false,
    sampleReviewed: true,
    billingPeriod: "one_time",
    bookingMode: "instant",
    packageRequired: true,
    maxQuantity: 1,
    quantityUnit: "visit",
    includes: [
      text([
        "The work listed in your selected option",
        "మీరు ఎంచుకున్న సేవలో పేర్కొన్న పని",
      ]),
    ],
    excludes: [],
    packages,
    addons,
    optionGroups: [],
    bookingFields: [],
    preparation: lines(preparation),
    checklist: [],
    warranty: "",
    faqs: [
      {
        question: text([
          "Will the price change after booking?",
          "బుక్ చేసిన తర్వాత ధర మారుతుందా?",
        ]),
        answer: text([
          "The price shown covers the selected work and extras. Parts or work outside that scope need your approval before they are added.",
          "చూపిన ధర మీరు ఎంచుకున్న పని, అదనపు సేవలకు వర్తిస్తుంది. విడిభాగాలు లేదా ఇతర పని చేర్చే ముందు మీ అంగీకారం అవసరం.",
        ]),
      },
      {
        question: text([
          "I am not sure which option to choose.",
          "ఏ సేవను ఎంచుకోవాలో తెలియడం లేదు.",
        ]),
        answer: text([
          "For a repair problem, choose the check-up option. For a larger or unusual job, contact the team before booking.",
          "మరమ్మతు సమస్యకు తనిఖీ సేవను ఎంచుకోండి. పెద్ద లేదా ప్రత్యేక పని ఉంటే బుక్ చేసే ముందు బృందాన్ని సంప్రదించండి.",
        ]),
      },
    ],
  };
}
export const standardServices = [
  service(
    "review-cleaning",
    ["Home cleaning", "ఇంటి శుభ్రత"],
    "Home cleaning",
    "spark",
    "home",
    [
      "Choose the room that needs cleaning. Cleaning tools and standard products are included.",
      "శుభ్రం చేయాల్సిన గదిని ఎంచుకోండి. శుభ్రపరిచే పరికరాలు, సాధారణ ఉత్పత్తులు ధరలో ఉన్నాయి.",
    ],
    [
      "One selected cleaning job. Water and electricity must be available.",
      "మీరు ఎంచుకున్న ఒక శుభ్రత సేవ. నీరు, విద్యుత్ అందుబాటులో ఉండాలి.",
    ],
    [
      pack(
        "bathroom",
        ["Clean 1 bathroom", "1 బాత్‌రూమ్ శుభ్రత"],
        529,
        60,
        [
          "For dirty tiles, toilet and hard-water deposits in one bathroom.",
          "ఒక బాత్‌రూమ్‌లో మురికి టైల్స్, టాయిలెట్, నీటి మరకల శుభ్రత.",
        ],
        [
          [
            "Toilet, basin, taps, shower and accessible tiles cleaned",
            "టాయిలెట్, బేసిన్, కుళాయిలు, షవర్, అందుబాటులో ఉన్న టైల్స్ శుభ్రత",
          ],
          [
            "One mirror, bathroom door and floor cleaned",
            "ఒక అద్దం, బాత్‌రూమ్ తలుపు, నేల శుభ్రత",
          ],
        ],
        cleaningExclusions,
      ),
      pack(
        "two-bathrooms",
        ["Clean 2 bathrooms together", "2 బాత్‌రూమ్‌ల శుభ్రత"],
        978,
        120,
        [
          "Both bathrooms cleaned in the same visit.",
          "ఒకే సందర్శనలో రెండు బాత్‌రూమ్‌ల శుభ్రత.",
        ],
        [
          [
            "The complete 1-bathroom scope for two bathrooms",
            "రెండు బాత్‌రూమ్‌లకు పూర్తి శుభ్రత సేవ",
          ],
          [
            "Toilets, basins, taps, mirrors, doors and floors cleaned",
            "టాయిలెట్లు, బేసిన్లు, కుళాయిలు, అద్దాలు, తలుపులు, నేలల శుభ్రత",
          ],
        ],
        cleaningExclusions,
      ),
      pack(
        "kitchen",
        ["Deep clean the kitchen", "వంటగది డీప్ క్లీనింగ్"],
        999,
        150,
        [
          "For oily counters, tiles and cabinet exteriors in one kitchen.",
          "ఒక వంటగదిలో జిడ్డుగా ఉన్న కౌంటర్లు, టైల్స్, క్యాబినెట్ల బయటి భాగాల శుభ్రత.",
        ],
        [
          [
            "Countertop, sink, accessible tiles and cabinet exteriors degreased",
            "కౌంటర్, సింక్, అందుబాటులో ఉన్న టైల్స్, క్యాబినెట్ల బయటి జిడ్డు తొలగింపు",
          ],
          [
            "Stove exterior and kitchen floor cleaned",
            "స్టవ్ బయటి భాగం, వంటగది నేల శుభ్రత",
          ],
        ],
        [
          ...cleaningExclusions,
          [
            "Appliance interiors, chimney motor and cabinet interiors",
            "ఉపకరణాల లోపలి భాగాలు, చిమ్నీ మోటర్, క్యాబినెట్ల లోపలి భాగాలు",
          ],
        ],
      ),
      pack(
        "sofa",
        ["Clean a 3-seat fabric sofa", "3 సీట్ల ఫ్యాబ్రిక్ సోఫా శుభ్రత"],
        1197,
        90,
        [
          "For dust and everyday dirt on a fabric sofa. Allow drying time.",
          "ఫ్యాబ్రిక్ సోఫాపై దుమ్ము, సాధారణ మురికి శుభ్రత. ఆరడానికి సమయం పడుతుంది.",
        ],
        [
          [
            "Fabric suitability check and vacuuming of up to three seats",
            "ఫ్యాబ్రిక్ అనుకూలత తనిఖీ, మూడు సీట్ల వరకు వాక్యూమింగ్",
          ],
          [
            "Suitable fabric shampoo and water extraction",
            "అనుకూలమైన ఫ్యాబ్రిక్ షాంపూ, నీటి వెలికితీత",
          ],
        ],
        [
          ...cleaningExclusions,
          [
            "Leather, velvet, repairs and guaranteed stain removal",
            "లెదర్, వెల్వెట్, మరమ్మతులు, అన్ని మరకలు తప్పక తొలగిస్తామనే హామీ",
          ],
        ],
      ),
      pack(
        "one-bedroom",
        [
          "Clean a furnished 1-bedroom home",
          "ఫర్నిచర్ ఉన్న 1 బెడ్‌రూమ్ ఇంటి శుభ్రత",
        ],
        3499,
        240,
        [
          "For one occupied 1-bedroom apartment up to 600 sq ft. Larger homes need a separate plan.",
          "ఫర్నిచర్ ఉన్న 600 చదరపు అడుగుల వరకు 1 బెడ్‌రూమ్ ఫ్లాట్‌కు. పెద్ద ఇళ్లకు వేరే ప్లాన్ అవసరం.",
        ],
        [
          [
            "One bedroom, living area and accessible furniture surfaces cleaned",
            "ఒక బెడ్‌రూమ్, హాల్, అందుబాటులో ఉన్న ఫర్నిచర్ పైభాగాల శుభ్రత",
          ],
          [
            "One bathroom, kitchen surfaces and accessible floors cleaned",
            "ఒక బాత్‌రూమ్, వంటగది పైభాగాలు, అందుబాటులో ఉన్న నేలల శుభ్రత",
          ],
        ],
        [
          ...cleaningExclusions,
          [
            "Appliance interiors, upholstery shampoo and high exterior windows",
            "ఉపకరణాల లోపలి భాగాలు, సోఫా షాంపూ, ఎత్తైన బయటి కిటికీలు",
          ],
        ],
      ),
      pack(
        "empty-home",
        [
          "Clean an empty 1-bedroom home",
          "ఖాళీగా ఉన్న 1 బెడ్‌రూమ్ ఇంటి శుభ్రత",
        ],
        3199,
        180,
        [
          "Before moving into an empty 1-bedroom apartment up to 600 sq ft.",
          "600 చదరపు అడుగుల వరకు ఖాళీ 1 బెడ్‌రూమ్ ఫ్లాట్‌లోకి మారే ముందు శుభ్రత.",
        ],
        [
          [
            "Empty bedroom, living area and accessible floors cleaned",
            "ఖాళీ బెడ్‌రూమ్, హాల్, అందుబాటులో ఉన్న నేలల శుభ్రత",
          ],
          [
            "One bathroom, kitchen surfaces and reachable windows cleaned",
            "ఒక బాత్‌రూమ్, వంటగది పైభాగాలు, అందుబాటులో ఉన్న కిటికీల శుభ్రత",
          ],
        ],
        [
          ...cleaningExclusions,
          [
            "Construction debris, cement and paint removal",
            "నిర్మాణ వ్యర్థాలు, సిమెంట్, పెయింట్ తొలగింపు",
          ],
        ],
      ),
    ],
    [
      extra(
        "fan-clean",
        ["Clean 1 ceiling fan", "1 సీలింగ్ ఫ్యాన్ శుభ్రత"],
        99,
        30,
        ["bathroom", "two-bathrooms", "kitchen", "sofa"],
      ),
      extra(
        "microwave",
        [
          "Clean the microwave inside and outside",
          "మైక్రోవేవ్ లోపల, బయట శుభ్రత",
        ],
        199,
        30,
        ["kitchen"],
      ),
      extra(
        "balcony",
        [
          "Clean 1 balcony up to 50 sq ft",
          "50 చదరపు అడుగుల వరకు 1 బాల్కనీ శుభ్రత",
        ],
        549,
        30,
        ["bathroom", "two-bathrooms", "kitchen", "sofa"],
      ),
    ],
    [
      [
        "Clear small items and valuables. Provide water and electricity.",
        "చిన్న వస్తువులు, విలువైన వస్తువులను పక్కన పెట్టండి. నీరు, విద్యుత్ అందుబాటులో ఉంచండి.",
      ],
    ],
  ),
  service(
    "review-ac",
    ["AC service & repair", "ఏసీ సర్వీస్, మరమ్మతు"],
    "AC repair",
    "air",
    "ac",
    [
      "AC dusty or not cooling? Choose cleaning for dust, or a check-up to find a fault.",
      "ఏసీలో దుమ్ము ఉందా, చల్లబడడం లేదా? దుమ్ముకు క్లీనింగ్, లోపాన్ని గుర్తించడానికి తనిఖీ ఎంచుకోండి.",
    ],
    [
      "Price covers the selected AC job. Parts and gas are extra after approval.",
      "ఎంచుకున్న ఏసీ పనికి ధర వర్తిస్తుంది. విడిభాగాలు, గ్యాస్‌కు అంగీకారం తర్వాత అదనపు ధర.",
    ],
    [
      pack(
        "split-clean",
        ["Clean 1 split AC", "1 స్ప్లిట్ ఏసీ శుభ్రత"],
        599,
        60,
        [
          "For dusty filters and weak airflow. Cleaning does not include repairs.",
          "ఫిల్టర్లలో దుమ్ము, గాలి తక్కువగా వస్తున్నప్పుడు. మరమ్మతులు ధరలో లేవు.",
        ],
        [
          [
            "Filter, accessible indoor coil and drain cleaning",
            "ఫిల్టర్, అందుబాటులో ఉన్న ఇండోర్ కాయిల్, డ్రెయిన్ శుభ్రత",
          ],
          [
            "Cooling and water-drain flow check after cleaning",
            "శుభ్రత తర్వాత కూలింగ్, నీరు బయటకు వెళ్లే విధానం తనిఖీ",
          ],
        ],
        acExclusions,
      ),
      pack(
        "two-ac",
        ["Clean 2 split ACs together", "2 స్ప్లిట్ ఏసీల శుభ్రత"],
        1098,
        120,
        [
          "Two ACs cleaned at the same address in one visit.",
          "ఒకే చిరునామాలో ఒక సందర్శనలో రెండు ఏసీల శుభ్రత.",
        ],
        [
          [
            "The split-AC cleaning scope for two units",
            "రెండు ఏసీలకు స్ప్లిట్ ఏసీ శుభ్రత సేవ",
          ],
          [
            "Filter, coil and drain cleaning with an operating check",
            "ఫిల్టర్, కాయిల్, డ్రెయిన్ శుభ్రత, పని చేస్తున్న విధానం తనిఖీ",
          ],
        ],
        acExclusions,
      ),
      pack(
        "ac-check",
        [
          "AC not cooling or leaking? Check-up",
          "ఏసీ చల్లబడడం లేదా నీరు కారుతోందా? తనిఖీ",
        ],
        299,
        60,
        [
          "Visit fee to find the problem. Repair and gas prices are explained before you agree.",
          "సమస్యను గుర్తించడానికి సందర్శన రుసుము. మరమ్మతు, గ్యాస్ ధరలను మీ అంగీకారానికి ముందు వివరిస్తాము.",
        ],
        [
          [
            "Check one AC and explain the fault",
            "ఒక ఏసీని తనిఖీ చేసి లోపాన్ని వివరించడం",
          ],
          [
            "Share the repair or parts price before extra work",
            "అదనపు పనికి ముందు మరమ్మతు లేదా విడిభాగాల ధర చెప్పడం",
          ],
        ],
        acExclusions,
      ),
      pack(
        "window-clean",
        ["Clean 1 window AC", "1 విండో ఏసీ శుభ్రత"],
        549,
        60,
        [
          "For dust and dirt in one accessible window AC.",
          "అందుబాటులో ఉన్న ఒక విండో ఏసీలో దుమ్ము, మురికి శుభ్రత.",
        ],
        [
          [
            "Accessible filter, coil and drain cleaning",
            "అందుబాటులో ఉన్న ఫిల్టర్, కాయిల్, డ్రెయిన్ శుభ్రత",
          ],
          [
            "Operating check and work-area tidy-up",
            "ఏసీ పని చేస్తున్న విధానం తనిఖీ, పని ప్రదేశం శుభ్రత",
          ],
        ],
        acExclusions,
      ),
      pack(
        "ac-install",
        ["Install 1 split AC", "1 స్ప్లిట్ ఏసీ అమరిక"],
        1099,
        120,
        [
          "Fit one indoor and outdoor unit where suitable brackets and connections already exist.",
          "తగిన బ్రాకెట్లు, కనెక్షన్లు ఉన్న చోట ఒక ఇండోర్, ఒక అవుట్‌డోర్ యూనిట్ అమరిక.",
        ],
        [
          [
            "Mount the indoor and outdoor units using existing suitable fittings",
            "ఇప్పటికే ఉన్న తగిన ఫిట్టింగులతో ఇండోర్, అవుట్‌డోర్ యూనిట్ల అమరిక",
          ],
          [
            "Connect existing suitable pipework and perform an operating check",
            "తగిన పాత పైపులను కనెక్ట్ చేసి పని చేస్తున్న విధానం తనిఖీ",
          ],
        ],
        acExclusions,
      ),
      pack(
        "ac-remove",
        ["Remove 1 split AC", "1 స్ప్లిట్ ఏసీ తొలగింపు"],
        699,
        60,
        [
          "Safely disconnect and remove one indoor and outdoor unit for shifting.",
          "ఇల్లు మారడానికి ఒక ఇండోర్, ఒక అవుట్‌డోర్ యూనిట్‌ను సురక్షితంగా డిస్‌కనెక్ట్ చేసి తొలగించడం.",
        ],
        [
          [
            "Disconnect and take down accessible indoor and outdoor units",
            "అందుబాటులో ఉన్న ఇండోర్, అవుట్‌డోర్ యూనిట్లను డిస్‌కనెక్ట్ చేసి దించడం",
          ],
          [
            "Hand over the removed units at the same address",
            "తొలగించిన యూనిట్లను అదే చిరునామాలో అందించడం",
          ],
        ],
        [
          ...acExclusions,
          [
            "Transport, reinstallation and wall repairs",
            "రవాణా, మళ్లీ అమరిక, గోడ మరమ్మతులు",
          ],
        ],
      ),
    ],
    [
      extra(
        "another-ac",
        ["Clean 1 more split AC", "మరో 1 స్ప్లిట్ ఏసీ శుభ్రత"],
        499,
        60,
        ["split-clean", "two-ac"],
      ),
    ],
    [
      [
        "Make the indoor unit and outdoor unit safely accessible.",
        "ఇండోర్, అవుట్‌డోర్ యూనిట్లు సురక్షితంగా అందుబాటులో ఉండేలా చూడండి.",
      ],
    ],
  ),
  service(
    "review-ro",
    ["Water purifier service", "వాటర్ ప్యూరిఫైయర్ సేవ"],
    "RO filter",
    "water",
    "ro",
    [
      "Low water flow, a leak or a purifier that will not start? Choose a check-up or a known installation job.",
      "నీరు తక్కువగా వస్తోందా, లీక్ అవుతోందా, ప్యూరిఫైయర్ ఆన్ కావడం లేదా? తనిఖీ లేదా అవసరమైన అమరిక సేవను ఎంచుకోండి.",
    ],
    [
      "Labour for one domestic purifier. Replacement filters and parts are not included.",
      "ఒక గృహ ప్యూరిఫైయర్‌కు పని రుసుము. కొత్త ఫిల్టర్లు, విడిభాగాలు ధరలో లేవు.",
    ],
    [
      pack(
        "ro-check",
        [
          "RO not working or leaking? Check-up",
          "ఆర్‌ఓ పని చేయడం లేదా లీక్ అవుతోందా? తనిఖీ",
        ],
        299,
        60,
        [
          "Find the fault first. Approve any repair or spare-part price before work starts.",
          "ముందుగా లోపాన్ని గుర్తిస్తాము. మరమ్మతు లేదా విడిభాగాల ధరకు అంగీకరించిన తర్వాతే పని.",
        ],
        [
          [
            "Inspect one domestic RO for visible leaks and operating faults",
            "ఒక గృహ ఆర్‌ఓలో కనిపించే లీకులు, పని లోపాల తనిఖీ",
          ],
          [
            "Explain the fault and provide the extra-work price",
            "లోపాన్ని వివరించి అదనపు పని ధర చెప్పడం",
          ],
        ],
        roExclusions,
      ),
      pack(
        "filter-check",
        [
          "Water flow low? Filter check-up",
          "నీటి ప్రవాహం తక్కువగా ఉందా? ఫిల్టర్ తనిఖీ",
        ],
        299,
        60,
        [
          "Not sure whether filters need changing? Get the condition and flow checked first.",
          "ఫిల్టర్లు మార్చాలో తెలియడం లేదా? ముందుగా వాటి స్థితి, నీటి ప్రవాహాన్ని తనిఖీ చేయించుకోండి.",
        ],
        [
          [
            "Check accessible filters, water flow and visible leaks",
            "అందుబాటులో ఉన్న ఫిల్టర్లు, నీటి ప్రవాహం, కనిపించే లీకుల తనిఖీ",
          ],
          [
            "Explain which filters, if any, need replacement",
            "ఏ ఫిల్టర్లు మార్చాల్సి ఉందో వివరించడం",
          ],
        ],
        roExclusions,
      ),
      pack(
        "filter-fit",
        ["Fit filters you already have", "మీ దగ్గరున్న ఫిల్టర్ల అమరిక"],
        299,
        60,
        [
          "Labour only. Have the correct compatible filters ready at home.",
          "పని రుసుము మాత్రమే. సరైన, అనుకూలమైన ఫిల్టర్లను ఇంట్లో సిద్ధంగా ఉంచండి.",
        ],
        [
          [
            "Check compatibility of customer-supplied filters",
            "మీరు ఇచ్చే ఫిల్టర్లు అనుకూలమైనవో తనిఖీ",
          ],
          [
            "Fit compatible filters, flush and check for visible leaks",
            "అనుకూలమైన ఫిల్టర్లను అమర్చి, ఫ్లష్ చేసి, లీకులు ఉన్నాయో తనిఖీ",
          ],
        ],
        roExclusions,
      ),
      pack(
        "wall-ro",
        ["Install a wall-mounted RO", "గోడకు ఆర్‌ఓ అమరిక"],
        449,
        60,
        [
          "For a ready water inlet, drain and power point near the purifier.",
          "ప్యూరిఫైయర్ దగ్గర నీటి ఇన్లెట్, డ్రెయిన్, పవర్ పాయింట్ సిద్ధంగా ఉన్నప్పుడు.",
        ],
        [
          [
            "Mount one domestic purifier on a suitable wall",
            "తగిన గోడపై ఒక గృహ ప్యూరిఫైయర్ అమరిక",
          ],
          [
            "Connect existing suitable pipes and check operation",
            "ఇప్పటికే ఉన్న తగిన పైపులను కనెక్ట్ చేసి పని చేస్తున్న విధానం తనిఖీ",
          ],
        ],
        roExclusions,
      ),
      pack(
        "counter-ro",
        ["Install an under-counter RO", "కౌంటర్ కింద ఆర్‌ఓ అమరిక"],
        649,
        90,
        [
          "For a compatible under-counter purifier with existing connections.",
          "ఇప్పటికే కనెక్షన్లు ఉన్న, అనుకూలమైన కౌంటర్ కింది ప్యూరిఫైయర్‌కు.",
        ],
        [
          [
            "Position one compatible purifier under the counter",
            "కౌంటర్ కింద అనుకూలమైన ఒక ప్యూరిఫైయర్‌ను ఉంచడం",
          ],
          [
            "Connect existing pipes and check for operation and leaks",
            "ఇప్పటికే ఉన్న పైపులను కనెక్ట్ చేసి పని, లీకుల తనిఖీ",
          ],
        ],
        roExclusions,
      ),
      pack(
        "remove-ro",
        ["Remove an RO for shifting", "ఇల్లు మారడానికి ఆర్‌ఓ తొలగింపు"],
        399,
        30,
        [
          "Disconnect one purifier and hand it over at the same address.",
          "ఒక ప్యూరిఫైయర్‌ను డిస్‌కనెక్ట్ చేసి అదే చిరునామాలో అందించడం.",
        ],
        [
          [
            "Turn off connections and disconnect one domestic purifier",
            "కనెక్షన్లు ఆపి ఒక గృహ ప్యూరిఫైయర్‌ను డిస్‌కనెక్ట్ చేయడం",
          ],
          [
            "Hand over the removed purifier and accessible fittings",
            "తొలగించిన ప్యూరిఫైయర్, అందుబాటులో ఉన్న ఫిట్టింగులు అందించడం",
          ],
        ],
        [
          ...roExclusions,
          [
            "Transport and installation at another address",
            "రవాణా, మరో చిరునామాలో అమరిక",
          ],
        ],
      ),
    ],
  ),
  service(
    "review-plumbing",
    ["Plumbing", "ప్లంబింగ్"],
    "Plumbing",
    "tool",
    "plumbing",
    [
      "Leaking tap, blocked basin or a faulty flush? Pick the job you need.",
      "కుళాయి లీక్ అవుతోందా, బేసిన్ బ్లాక్ అయిందా, ఫ్లష్ సమస్యా? అవసరమైన పనిని ఎంచుకోండి.",
    ],
    [
      "Labour for the selected job. New taps, pipes and fittings are extra.",
      "ఎంచుకున్న పనికి పని రుసుము. కొత్త కుళాయిలు, పైపులు, ఫిట్టింగులకు అదనపు ధర.",
    ],
    [
      pack(
        "tap-repair",
        ["Fix 1 leaking tap", "లీక్ అయ్యే 1 కుళాయి మరమ్మతు"],
        129,
        30,
        [
          "For one accessible tap that drips or does not close properly.",
          "చుక్కలు పడే లేదా సరిగ్గా మూసుకోని, అందుబాటులో ఉన్న ఒక కుళాయికి.",
        ],
        [
          [
            "Check and repair one accessible tap mechanism",
            "అందుబాటులో ఉన్న ఒక కుళాయి వ్యవస్థ తనిఖీ, మరమ్మతు",
          ],
          [
            "Check water flow and visible leaks after the work",
            "పని తర్వాత నీటి ప్రవాహం, కనిపించే లీకుల తనిఖీ",
          ],
        ],
        parts,
      ),
      pack(
        "tap-fit",
        ["Fit or replace 1 tap", "1 కుళాయి అమరిక లేదా మార్పు"],
        129,
        30,
        [
          "Have the new compatible tap ready. Labour only.",
          "అనుకూలమైన కొత్త కుళాయిని సిద్ధంగా ఉంచండి. పని రుసుము మాత్రమే.",
        ],
        [
          [
            "Remove the old accessible tap if needed",
            "అవసరమైతే అందుబాటులో ఉన్న పాత కుళాయి తొలగింపు",
          ],
          [
            "Fit one compatible tap and check for leaks",
            "అనుకూలమైన ఒక కుళాయిని అమర్చి లీకుల తనిఖీ",
          ],
        ],
        parts,
      ),
      pack(
        "flush-fix",
        ["Fix a flush tank problem", "ఫ్లష్ ట్యాంక్ సమస్య మరమ్మతు"],
        199,
        30,
        [
          "For a flush tank that keeps running or will not fill properly.",
          "నీరు ఆగకుండా వచ్చే లేదా సరిగ్గా నిండని ఫ్లష్ ట్యాంక్‌కు.",
        ],
        [
          [
            "Inspect and adjust one accessible flush mechanism",
            "అందుబాటులో ఉన్న ఒక ఫ్లష్ వ్యవస్థ తనిఖీ, సర్దుబాటు",
          ],
          [
            "Check filling and flushing after the work",
            "పని తర్వాత నీరు నిండడం, ఫ్లష్ పని తనిఖీ",
          ],
        ],
        parts,
      ),
      pack(
        "basin-block",
        ["Clear 1 blocked washbasin", "బ్లాక్ అయిన 1 వాష్‌బేసిన్ శుభ్రపరచడం"],
        199,
        30,
        [
          "For a blockage in the accessible basin waste pipe or trap.",
          "అందుబాటులో ఉన్న బేసిన్ వేస్ట్ పైపు లేదా ట్రాప్‌లో బ్లాకేజీకి.",
        ],
        [
          [
            "Open and clean one accessible basin trap or waste connection",
            "అందుబాటులో ఉన్న ఒక బేసిన్ ట్రాప్ లేదా వేస్ట్ కనెక్షన్ తెరిచి శుభ్రపరచడం",
          ],
          [
            "Reassemble and check drainage and leaks",
            "మళ్లీ అమర్చి నీరు వెళ్లడం, లీకుల తనిఖీ",
          ],
        ],
        [
          ...parts,
          [
            "Deep drain blockages and breaking walls or floors",
            "లోతైన డ్రెయిన్ బ్లాకేజీలు, గోడలు లేదా నేల పగలగొట్టడం",
          ],
        ],
      ),
      pack(
        "shower-fit",
        ["Fit or replace 1 shower head", "1 షవర్ హెడ్ అమరిక లేదా మార్పు"],
        129,
        30,
        [
          "Fit a compatible shower head you provide to an existing connection.",
          "ఇప్పటికే ఉన్న కనెక్షన్‌కు మీరు ఇచ్చే అనుకూలమైన షవర్ హెడ్ అమరిక.",
        ],
        [
          [
            "Remove one old accessible shower head",
            "అందుబాటులో ఉన్న ఒక పాత షవర్ హెడ్ తొలగింపు",
          ],
          [
            "Fit the supplied shower head and check water flow",
            "మీరు ఇచ్చే షవర్ హెడ్‌ను అమర్చి నీటి ప్రవాహం తనిఖీ",
          ],
        ],
        parts,
      ),
      pack(
        "plumber-check",
        [
          "Not sure? Book a plumber check-up",
          "తెలియడం లేదా? ప్లంబర్ తనిఖీ బుక్ చేయండి",
        ],
        49,
        30,
        [
          "Inspection visit only. We explain the problem and repair price before you agree.",
          "తనిఖీ సందర్శన మాత్రమే. మీ అంగీకారానికి ముందు సమస్య, మరమ్మతు ధర వివరిస్తాము.",
        ],
        [
          [
            "Inspect one plumbing issue at your address",
            "మీ చిరునామాలో ఒక ప్లంబింగ్ సమస్య తనిఖీ",
          ],
          [
            "Explain the required work and its separate price",
            "అవసరమైన పని, దానికి వేరే ధర వివరించడం",
          ],
        ],
        [
          ...parts,
          [
            "Repair labour is not included in this check-up fee",
            "ఈ తనిఖీ రుసుములో మరమ్మతు పని రుసుము లేదు",
          ],
        ],
      ),
    ],
    [
      extra(
        "extra-tap",
        ["Fix 1 more leaking tap", "మరో లీక్ అయ్యే 1 కుళాయి మరమ్మతు"],
        129,
        30,
        ["tap-repair", "tap-fit", "flush-fix", "basin-block", "shower-fit"],
      ),
      extra(
        "jet-spray",
        ["Fit 1 jet spray you provide", "మీరు ఇచ్చే 1 జెట్ స్ప్రే అమరిక"],
        199,
        30,
        ["flush-fix"],
      ),
    ],
  ),
  service(
    "review-electrical",
    ["Electrician", "ఎలక్ట్రిషియన్"],
    "Electrician",
    "bolt",
    "electrical",
    [
      "A switch not working, a noisy fan or a light to fit? Choose a simple job or a check-up.",
      "స్విచ్ పని చేయడం లేదా, ఫ్యాన్ శబ్దం చేస్తోందా, లైట్ అమర్చాలా? అవసరమైన పని లేదా తనిఖీ ఎంచుకోండి.",
    ],
    [
      "Labour only. Compatible switches, lights, fans and parts must be supplied or approved separately.",
      "పని రుసుము మాత్రమే. అనుకూలమైన స్విచ్‌లు, లైట్లు, ఫ్యాన్లు, విడిభాగాలను ఇవ్వాలి లేదా వేరుగా ధరకు అంగీకరించాలి.",
    ],
    [
      pack(
        "switch-fit",
        ["Replace 1 switch or socket", "1 స్విచ్ లేదా సాకెట్ మార్పు"],
        79,
        30,
        [
          "For one faulty switch or socket on an accessible existing board.",
          "అందుబాటులో ఉన్న పాత బోర్డుపై పని చేయని ఒక స్విచ్ లేదా సాకెట్‌కు.",
        ],
        [
          [
            "Check one switch or socket on an existing board",
            "ఇప్పటికే ఉన్న బోర్డుపై ఒక స్విచ్ లేదా సాకెట్ తనిఖీ",
          ],
          [
            "Fit one compatible customer-supplied replacement and test",
            "మీరు ఇచ్చే అనుకూలమైన విడిభాగాన్ని అమర్చి పరీక్షించడం",
          ],
        ],
        parts,
      ),
      pack(
        "fan-fit",
        [
          "Install or replace 1 ceiling fan",
          "1 సీలింగ్ ఫ్యాన్ అమరిక లేదా మార్పు",
        ],
        99,
        30,
        [
          "For a standard fan on a safe existing hook and wiring point.",
          "సురక్షితమైన పాత హుక్, వైరింగ్ ఉన్న చోట సాధారణ ఫ్యాన్‌కు.",
        ],
        [
          [
            "Remove one existing fan if required",
            "అవసరమైతే ఒక పాత ఫ్యాన్ తొలగింపు",
          ],
          [
            "Fit a compatible standard fan and check operation",
            "అనుకూలమైన సాధారణ ఫ్యాన్‌ను అమర్చి పని తనిఖీ",
          ],
        ],
        parts,
      ),
      pack(
        "fan-repair",
        [
          "Fan slow or noisy? Repair visit",
          "ఫ్యాన్ నెమ్మదిగా లేదా శబ్దంగా ఉందా? మరమ్మతు",
        ],
        149,
        60,
        [
          "Check and adjust one standard fan. Replacement parts cost extra after approval.",
          "ఒక సాధారణ ఫ్యాన్ తనిఖీ, సర్దుబాటు. విడిభాగాలకు మీ అంగీకారం తర్వాత అదనపు ధర.",
        ],
        [
          [
            "Inspect one accessible standard ceiling fan",
            "అందుబాటులో ఉన్న ఒక సాధారణ సీలింగ్ ఫ్యాన్ తనిఖీ",
          ],
          [
            "Tighten accessible fittings, check connections and test",
            "అందుబాటులో ఉన్న ఫిట్టింగులు బిగించి, కనెక్షన్ల తనిఖీ, పరీక్ష",
          ],
        ],
        [
          ...parts,
          [
            "Motor rewinding, BLDC electronics and major repairs",
            "మోటర్ రీవైండింగ్, బీఎల్‌డీసీ ఎలక్ట్రానిక్స్, పెద్ద మరమ్మతులు",
          ],
        ],
      ),
      pack(
        "light-fit",
        ["Fit 1 tube light or LED fitting", "1 ట్యూబ్ లైట్ లేదా ఎల్‌ఈడీ అమరిక"],
        99,
        30,
        [
          "Fit a compatible light at an existing accessible wiring point.",
          "అందుబాటులో ఉన్న పాత వైరింగ్ పాయింట్ వద్ద అనుకూలమైన లైట్ అమరిక.",
        ],
        [
          [
            "Remove one old standard fitting if needed",
            "అవసరమైతే ఒక పాత సాధారణ ఫిట్టింగ్ తొలగింపు",
          ],
          [
            "Fit the supplied light and test the existing connection",
            "మీరు ఇచ్చే లైట్‌ను అమర్చి పాత కనెక్షన్ పరీక్షించడం",
          ],
        ],
        parts,
      ),
      pack(
        "mcb-fit",
        ["Replace 1 MCB switch", "1 ఎమ్‌సీబీ స్విచ్ మార్పు"],
        149,
        30,
        [
          "Replace one compatible breaker in a safe accessible board. New breaker not included.",
          "సురక్షితంగా అందుబాటులో ఉన్న బోర్డులో ఒక అనుకూలమైన బ్రేకర్ మార్పు. కొత్త బ్రేకర్ ధరలో లేదు.",
        ],
        [
          [
            "Inspect the existing breaker connection",
            "పాత బ్రేకర్ కనెక్షన్ తనిఖీ",
          ],
          [
            "Fit one compatible customer-supplied MCB and test",
            "మీరు ఇచ్చే అనుకూలమైన ఒక ఎమ్‌సీబీ అమరిక, పరీక్ష",
          ],
        ],
        parts,
      ),
      pack(
        "electric-check",
        [
          "Not sure? Book an electrician check-up",
          "తెలియడం లేదా? ఎలక్ట్రిషియన్ తనిఖీ బుక్ చేయండి",
        ],
        49,
        30,
        [
          "Inspection visit only. We explain the fault and repair price before you agree.",
          "తనిఖీ సందర్శన మాత్రమే. మీ అంగీకారానికి ముందు లోపం, మరమ్మతు ధర వివరిస్తాము.",
        ],
        [
          [
            "Inspect one household electrical issue",
            "ఇంట్లో ఒక విద్యుత్ సమస్య తనిఖీ",
          ],
          [
            "Explain the required work and its separate price",
            "అవసరమైన పని, దానికి వేరే ధర వివరించడం",
          ],
        ],
        [
          ...parts,
          [
            "Repair labour is not included in this check-up fee",
            "ఈ తనిఖీ రుసుములో మరమ్మతు పని రుసుము లేదు",
          ],
        ],
      ),
    ],
    [
      extra(
        "extra-switch",
        ["Replace 1 more switch or socket", "మరో 1 స్విచ్ లేదా సాకెట్ మార్పు"],
        79,
        30,
        ["switch-fit", "fan-fit", "fan-repair", "light-fit", "mcb-fit"],
      ),
      extra(
        "regulator",
        [
          "Fit a fan regulator you provide",
          "మీరు ఇచ్చే ఫ్యాన్ రెగ్యులేటర్ అమరిక",
        ],
        89,
        30,
        ["fan-fit", "fan-repair"],
      ),
    ],
  ),
  service(
    "review-car-wash",
    ["One-time car cleaning", "ఒక్కసారి కారు శుభ్రత"],
    "Car Care",
    "tool",
    "car",
    [
      "Need a car clean today without a monthly plan? Choose an outside wash or inside-and-out clean.",
      "నెలవారీ ప్లాన్ లేకుండా ఈ రోజు కారు శుభ్రత కావాలా? బయటి వాష్ లేదా లోపల, బయట శుభ్రత ఎంచుకోండి.",
    ],
    [
      "One car at your parking spot. Provide water, power and safe access.",
      "మీ పార్కింగ్ వద్ద ఒక కారు. నీరు, విద్యుత్, సురక్షిత ప్రవేశం అందించాలి.",
    ],
    [
      pack(
        "car-outside",
        ["Small car: outside wash", "చిన్న కారు: బయటి వాష్"],
        499,
        60,
        [
          "For a hatchback or sedan with dust and everyday dirt outside.",
          "హ్యాచ్‌బ్యాక్ లేదా సెడాన్ బయట దుమ్ము, సాధారణ మురికి శుభ్రతకు.",
        ],
        [
          [
            "Body, wheel surfaces and exterior glass washed",
            "బాడీ, చక్రాల పైభాగాలు, బయటి అద్దాల వాష్",
          ],
          [
            "Microfibre exterior drying",
            "మైక్రోఫైబర్‌తో బయటి భాగం తుడిచి ఆరబెట్టడం",
          ],
        ],
        carExclusions,
      ),
      pack(
        "car-inside",
        ["Small car: inside and outside", "చిన్న కారు: లోపల, బయట శుభ్రత"],
        899,
        90,
        [
          "For a hatchback or sedan needing an outside wash and interior vacuum.",
          "బయటి వాష్, లోపల వాక్యూమింగ్ అవసరమైన హ్యాచ్‌బ్యాక్ లేదా సెడాన్‌కు.",
        ],
        [
          [
            "Outside wash, glass cleaning and drying",
            "బయటి వాష్, అద్దాల శుభ్రత, ఆరబెట్టడం",
          ],
          [
            "Interior vacuum, dashboard wipe and mat surface cleaning",
            "లోపల వాక్యూమింగ్, డ్యాష్‌బోర్డ్ తుడవడం, మ్యాట్ల పైభాగం శుభ్రత",
          ],
        ],
        [
          ...carExclusions,
          [
            "Seat shampoo, roof-lining cleaning and stain restoration",
            "సీట్ల షాంపూ, రూఫ్ లైనింగ్ శుభ్రత, మరకల పునరుద్ధరణ",
          ],
        ],
      ),
      pack(
        "suv-outside",
        ["SUV / 7-seater: outside wash", "ఎస్‌యూవీ / 7 సీట్లు: బయటి వాష్"],
        699,
        60,
        [
          "An exterior wash for one SUV or seven-seat car.",
          "ఒక ఎస్‌యూవీ లేదా ఏడు సీట్ల కారు బయటి వాష్.",
        ],
        [
          [
            "Body, wheel surfaces and exterior glass washed",
            "బాడీ, చక్రాల పైభాగాలు, బయటి అద్దాల వాష్",
          ],
          [
            "Microfibre exterior drying",
            "మైక్రోఫైబర్‌తో బయటి భాగం తుడిచి ఆరబెట్టడం",
          ],
        ],
        carExclusions,
      ),
      pack(
        "suv-inside",
        [
          "SUV / 7-seater: inside and outside",
          "ఎస్‌యూవీ / 7 సీట్లు: లోపల, బయట శుభ్రత",
        ],
        1099,
        90,
        [
          "An exterior wash and interior vacuum for one SUV or seven-seat car.",
          "ఒక ఎస్‌యూవీ లేదా ఏడు సీట్ల కారుకు బయటి వాష్, లోపల వాక్యూమింగ్.",
        ],
        [
          [
            "Outside wash, glass cleaning and drying",
            "బయటి వాష్, అద్దాల శుభ్రత, ఆరబెట్టడం",
          ],
          [
            "Interior vacuum, dashboard wipe and mat surface cleaning",
            "లోపల వాక్యూమింగ్, డ్యాష్‌బోర్డ్ తుడవడం, మ్యాట్ల పైభాగం శుభ్రత",
          ],
        ],
        [
          ...carExclusions,
          [
            "Seat shampoo, roof-lining cleaning and stain restoration",
            "సీట్ల షాంపూ, రూఫ్ లైనింగ్ శుభ్రత, మరకల పునరుద్ధరణ",
          ],
        ],
      ),
    ],
    [
      extra(
        "car-mats",
        [
          "Deep clean rubber floor mats",
          "రబ్బరు ఫ్లోర్ మ్యాట్ల డీప్ క్లీనింగ్",
        ],
        149,
        30,
        ["car-outside", "car-inside", "suv-outside", "suv-inside"],
      ),
    ],
  ),
].map((s, order) => ({ ...s, order }));
standardServices.find((s) => s.id === "review-car-wash").bookingFields = [
  {
    id: "vehicle",
    label: text(["Car make and model", "కారు తయారీ సంస్థ, మోడల్"]),
    placeholder: text(["Example: Maruti Swift", "ఉదాహరణ: మారుతి స్విఫ్ట్"]),
    help: "",
    required: true,
  },
  {
    id: "parking",
    label: text(["Parking instructions", "పార్కింగ్ వివరాలు"]),
    placeholder: text([
      "Example: basement B2, bay 14",
      "ఉదాహరణ: బేస్‌మెంట్ బీ2, స్థలం 14",
    ]),
    help: text([
      "Keep the car unlocked for interior cleaning. You do not need to share its registration number.",
      "లోపలి శుభ్రతకు కారు తలుపులు తెరవాలి. రిజిస్ట్రేషన్ నంబర్ చెప్పాల్సిన అవసరం లేదు.",
    ]),
    required: true,
  },
];

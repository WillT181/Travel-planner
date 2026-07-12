/**
 * Local seed data for the destination browser. No external API yet — this is
 * the single source of truth for /explore and /explore/[destination].
 */

export type Mood = "Beach" | "City" | "Adventure" | "Culture" | "Budget";

/** Mood filter options for the pill row ("All" means no filter). */
export const MOODS: Mood[] = [
  "Beach",
  "City",
  "Adventure",
  "Culture",
  "Budget",
];

export interface ItineraryDay {
  morning: string;
  afternoon: string;
  evening: string;
}

export interface QuickFacts {
  bestMonths: string;
  avgBudgetPerDay: string;
  language: string;
  currency: string;
}

export interface Destination {
  slug: string;
  name: string;
  country: string;
  /** Legacy image seed — kept as an images.json lookup alias. */
  imageSeed: string;
  moods: Mood[];
  bestTimeToVisit: string;
  summary: string;
  quickFacts: QuickFacts;
  sampleItinerary: [ItineraryDay, ItineraryDay, ItineraryDay];
}

export const DESTINATIONS: Destination[] = [
  {
    slug: "lisbon",
    name: "Lisbon",
    country: "Portugal",
    imageSeed: "lisbon-pt",
    moods: ["City", "Culture", "Budget", "Beach"],
    bestTimeToVisit: "March–May & September–October",
    summary:
      "Sun-washed hills, pastel tiles, and clattering trams — Lisbon pairs old-world charm with a buzzing café and beach scene.",
    quickFacts: {
      bestMonths: "Mar–May, Sep–Oct",
      avgBudgetPerDay: "£60–90",
      language: "Portuguese",
      currency: "Euro (€)",
    },
    sampleItinerary: [
      {
        morning: "Ride Tram 28 through Alfama's lanes",
        afternoon: "Explore São Jorge Castle and viewpoints",
        evening: "Fado dinner in a Bairro Alto tavern",
      },
      {
        morning: "Pastéis de nata in Belém",
        afternoon: "Jerónimos Monastery and riverside walk",
        evening: "Sunset drinks at a miradouro",
      },
      {
        morning: "Day trip to colourful Sintra palaces",
        afternoon: "Beach time at Cascais",
        evening: "Seafood at the Time Out Market",
      },
    ],
  },
  {
    slug: "kyoto",
    name: "Kyoto",
    country: "Japan",
    imageSeed: "kyoto-jp",
    moods: ["City", "Culture"],
    bestTimeToVisit: "March–April & October–November",
    summary:
      "Japan's old capital is a hushed world of temples, tea houses, and bamboo groves — most magical under cherry blossom or autumn leaves.",
    quickFacts: {
      bestMonths: "Mar–Apr, Oct–Nov",
      avgBudgetPerDay: "£90–140",
      language: "Japanese",
      currency: "Japanese Yen (¥)",
    },
    sampleItinerary: [
      {
        morning: "Walk the Fushimi Inari torii gates",
        afternoon: "Tea ceremony in Gion district",
        evening: "Spot geiko on Pontocho Alley",
      },
      {
        morning: "Arashiyama bamboo grove at dawn",
        afternoon: "Golden Pavilion (Kinkaku-ji)",
        evening: "Kaiseki dinner by the Kamo River",
      },
      {
        morning: "Zen gardens at Ryoan-ji",
        afternoon: "Nishiki Market food crawl",
        evening: "Night stroll through Higashiyama",
      },
    ],
  },
  {
    slug: "bali",
    name: "Bali",
    country: "Indonesia",
    imageSeed: "bali-id",
    moods: ["Beach", "Adventure", "Budget"],
    bestTimeToVisit: "April–October (dry season)",
    summary:
      "Rice terraces, surf breaks, and clifftop temples — Bali blends laid-back beach days with jungle adventure and deep spirituality.",
    quickFacts: {
      bestMonths: "Apr–Oct",
      avgBudgetPerDay: "£35–60",
      language: "Indonesian, Balinese",
      currency: "Indonesian Rupiah (Rp)",
    },
    sampleItinerary: [
      {
        morning: "Sunrise over Tegallalang rice terraces",
        afternoon: "Ubud's Monkey Forest and art markets",
        evening: "Dinner with a jungle view",
      },
      {
        morning: "Surf lesson at Canggu beach",
        afternoon: "Relax at a beach club",
        evening: "Seafood BBQ on Jimbaran sands",
      },
      {
        morning: "Clifftop Uluwatu Temple",
        afternoon: "Snorkel the reefs off Nusa Penida",
        evening: "Kecak fire dance at sunset",
      },
    ],
  },
  {
    slug: "marrakech",
    name: "Marrakech",
    country: "Morocco",
    imageSeed: "marrakech-ma",
    moods: ["Culture", "City", "Budget"],
    bestTimeToVisit: "March–May & September–November",
    summary:
      "A feast for the senses: labyrinthine souks, hidden riad courtyards, and the drumbeat of Jemaa el-Fnaa after dark.",
    quickFacts: {
      bestMonths: "Mar–May, Sep–Nov",
      avgBudgetPerDay: "£40–70",
      language: "Arabic, Berber, French",
      currency: "Moroccan Dirham (MAD)",
    },
    sampleItinerary: [
      {
        morning: "Get lost in the medina souks",
        afternoon: "Bahia Palace and Saadian Tombs",
        evening: "Street food on Jemaa el-Fnaa",
      },
      {
        morning: "Calm of the Majorelle Garden",
        afternoon: "Hammam and mint tea ritual",
        evening: "Rooftop tagine at sunset",
      },
      {
        morning: "Day trip toward the Atlas Mountains",
        afternoon: "Berber village and waterfalls",
        evening: "Return for a riad dinner",
      },
    ],
  },
  {
    slug: "reykjavik",
    name: "Reykjavík",
    country: "Iceland",
    imageSeed: "reykjavik-is",
    moods: ["Adventure"],
    bestTimeToVisit: "June–August (or Sep–Mar for auroras)",
    summary:
      "Base camp for fire and ice — waterfalls, geysers, black-sand beaches, and the Northern Lights all within easy reach.",
    quickFacts: {
      bestMonths: "Jun–Aug, Sep–Mar (auroras)",
      avgBudgetPerDay: "£120–180",
      language: "Icelandic",
      currency: "Icelandic Króna (kr)",
    },
    sampleItinerary: [
      {
        morning: "Soak in the Blue Lagoon",
        afternoon: "Explore central Reykjavík and Hallgrímskirkja",
        evening: "Northern Lights hunt (in season)",
      },
      {
        morning: "Golden Circle: Þingvellir rift",
        afternoon: "Geysir and Gullfoss waterfall",
        evening: "Dinner of lamb and skyr",
      },
      {
        morning: "South coast waterfalls",
        afternoon: "Reynisfjara black-sand beach",
        evening: "Glacier-view soak at a hot spring",
      },
    ],
  },
  {
    slug: "santorini",
    name: "Santorini",
    country: "Greece",
    imageSeed: "santorini-gr",
    moods: ["Beach", "Culture"],
    bestTimeToVisit: "May–June & September",
    summary:
      "Whitewashed villages tumble down volcanic cliffs above a sapphire caldera — the Aegean's most photogenic sunset awaits.",
    quickFacts: {
      bestMonths: "May–Jun, Sep",
      avgBudgetPerDay: "£90–150",
      language: "Greek",
      currency: "Euro (€)",
    },
    sampleItinerary: [
      {
        morning: "Wander the cliff paths of Oia",
        afternoon: "Caldera boat trip and hot springs",
        evening: "Famous Oia sunset with wine",
      },
      {
        morning: "Red Beach and Akrotiri ruins",
        afternoon: "Wine tasting at a cliff winery",
        evening: "Seafood taverna in Ammoudi Bay",
      },
      {
        morning: "Hike Fira to Oia along the rim",
        afternoon: "Swim at Perissa black beach",
        evening: "Rooftop dinner in Fira",
      },
    ],
  },
  {
    slug: "bangkok",
    name: "Bangkok",
    country: "Thailand",
    imageSeed: "bangkok-th",
    moods: ["City", "Culture", "Budget"],
    bestTimeToVisit: "November–February (cool & dry)",
    summary:
      "Golden temples, canal markets, and some of the world's best street food — Bangkok runs at full throttle, day and night.",
    quickFacts: {
      bestMonths: "Nov–Feb",
      avgBudgetPerDay: "£30–55",
      language: "Thai",
      currency: "Thai Baht (฿)",
    },
    sampleItinerary: [
      {
        morning: "Grand Palace and Wat Phra Kaew",
        afternoon: "Long-tail boat along the klongs",
        evening: "Street food on Yaowarat (Chinatown)",
      },
      {
        morning: "Reclining Buddha at Wat Pho",
        afternoon: "Thai massage and Chatuchak market",
        evening: "Rooftop bar over the skyline",
      },
      {
        morning: "Floating market day trip",
        afternoon: "Jim Thompson House",
        evening: "Dinner cruise on the Chao Phraya",
      },
    ],
  },
  {
    slug: "hanoi",
    name: "Hanoi",
    country: "Vietnam",
    imageSeed: "hanoi-vn",
    moods: ["City", "Culture", "Budget"],
    bestTimeToVisit: "October–April",
    summary:
      "Motorbike symphonies, lakeside temples, and egg coffee in the Old Quarter — Hanoi is chaotic, charming, and delicious.",
    quickFacts: {
      bestMonths: "Oct–Apr",
      avgBudgetPerDay: "£25–45",
      language: "Vietnamese",
      currency: "Vietnamese Đồng (₫)",
    },
    sampleItinerary: [
      {
        morning: "Coffee by Hoan Kiem Lake",
        afternoon: "Old Quarter walking tour",
        evening: "Bia hoi on the corner and street pho",
      },
      {
        morning: "Ho Chi Minh Mausoleum complex",
        afternoon: "Temple of Literature",
        evening: "Water puppet theatre show",
      },
      {
        morning: "Cooking class with market visit",
        afternoon: "Train Street and French Quarter",
        evening: "Rooftop drinks over the city",
      },
    ],
  },
  {
    slug: "queenstown",
    name: "Queenstown",
    country: "New Zealand",
    imageSeed: "queenstown-nz",
    moods: ["Adventure"],
    bestTimeToVisit: "December–February & June–August (ski)",
    summary:
      "The adventure capital of the world — bungy, jet boats, and alpine hikes ringed by the jagged Remarkables.",
    quickFacts: {
      bestMonths: "Dec–Feb, Jun–Aug (ski)",
      avgBudgetPerDay: "£90–150",
      language: "English, Māori",
      currency: "New Zealand Dollar (NZ$)",
    },
    sampleItinerary: [
      {
        morning: "Skyline gondola and luge",
        afternoon: "Jet boat through Shotover canyons",
        evening: "Famous Fergburger by the lake",
      },
      {
        morning: "Bungy at the Kawarau Bridge",
        afternoon: "Wine tasting in Gibbston Valley",
        evening: "Lakeside sunset and dinner",
      },
      {
        morning: "Drive to Glenorchy",
        afternoon: "Hike a Lord of the Rings trail",
        evening: "Stargazing in dark skies",
      },
    ],
  },
  {
    slug: "cusco",
    name: "Cusco",
    country: "Peru",
    imageSeed: "cusco-pe",
    moods: ["Adventure", "Culture", "Budget"],
    bestTimeToVisit: "May–September (dry season)",
    summary:
      "The gateway to Machu Picchu, where Inca stonework meets Andean markets at a lofty 3,400 metres.",
    quickFacts: {
      bestMonths: "May–Sep",
      avgBudgetPerDay: "£40–70",
      language: "Spanish, Quechua",
      currency: "Peruvian Sol (S/)",
    },
    sampleItinerary: [
      {
        morning: "Acclimatise around Plaza de Armas",
        afternoon: "San Pedro Market and Qorikancha",
        evening: "Pisco sour and Andean dinner",
      },
      {
        morning: "Sacred Valley: Pisac ruins",
        afternoon: "Ollantaytambo fortress",
        evening: "Overnight near Aguas Calientes",
      },
      {
        morning: "Sunrise at Machu Picchu",
        afternoon: "Guided tour of the citadel",
        evening: "Train back to Cusco",
      },
    ],
  },
  {
    slug: "maasai-mara",
    name: "Maasai Mara",
    country: "Kenya",
    imageSeed: "maasai-mara-ke",
    moods: ["Adventure"],
    bestTimeToVisit: "July–October (Great Migration)",
    summary:
      "Endless golden savannah and the drama of the Great Migration — the Mara is the quintessential African safari.",
    quickFacts: {
      bestMonths: "Jul–Oct",
      avgBudgetPerDay: "£150–300",
      language: "Swahili, English",
      currency: "Kenyan Shilling (KSh)",
    },
    sampleItinerary: [
      {
        morning: "Dawn game drive for the big cats",
        afternoon: "Brunch back at camp, siesta",
        evening: "Sundowner game drive",
      },
      {
        morning: "Track the migration river crossings",
        afternoon: "Visit a Maasai village",
        evening: "Bush dinner under the stars",
      },
      {
        morning: "Hot-air balloon over the plains",
        afternoon: "Champagne breakfast on the savannah",
        evening: "Final sunset and campfire stories",
      },
    ],
  },
  {
    slug: "amalfi-coast",
    name: "Amalfi Coast",
    country: "Italy",
    imageSeed: "amalfi-it",
    moods: ["Beach", "Culture"],
    bestTimeToVisit: "May–June & September",
    summary:
      "Lemon groves, pastel villages, and hairpin coastal roads above the Tyrrhenian Sea — la dolce vita at its finest.",
    quickFacts: {
      bestMonths: "May–Jun, Sep",
      avgBudgetPerDay: "£100–160",
      language: "Italian",
      currency: "Euro (€)",
    },
    sampleItinerary: [
      {
        morning: "Stroll Positano's cliffside lanes",
        afternoon: "Beach club on the pebbled shore",
        evening: "Seafood pasta with a sea view",
      },
      {
        morning: "Boat to the island of Capri",
        afternoon: "Blue Grotto and Anacapri",
        evening: "Aperitivo in the piazzetta",
      },
      {
        morning: "Ravello's gardens and villas",
        afternoon: "Limoncello tasting",
        evening: "Sunset dinner in Amalfi town",
      },
    ],
  },
  {
    slug: "dubrovnik",
    name: "Dubrovnik",
    country: "Croatia",
    imageSeed: "dubrovnik-hr",
    moods: ["Beach", "City", "Culture"],
    bestTimeToVisit: "May–June & September",
    summary:
      "The 'Pearl of the Adriatic' — marble streets within mighty medieval walls, lapped by impossibly blue water.",
    quickFacts: {
      bestMonths: "May–Jun, Sep",
      avgBudgetPerDay: "£70–110",
      language: "Croatian",
      currency: "Euro (€)",
    },
    sampleItinerary: [
      {
        morning: "Walk the Old Town city walls",
        afternoon: "Cable car up Mount Srđ",
        evening: "Seafood in a stone-walled konoba",
      },
      {
        morning: "Kayak around the island of Lokrum",
        afternoon: "Swim at Banje Beach",
        evening: "Sunset cocktails on the cliffs",
      },
      {
        morning: "Boat trip to the Elaphiti Islands",
        afternoon: "Snorkel hidden coves",
        evening: "Game of Thrones walking tour",
      },
    ],
  },
  {
    slug: "tulum",
    name: "Tulum",
    country: "Mexico",
    imageSeed: "tulum-mx",
    moods: ["Beach", "Adventure"],
    bestTimeToVisit: "November–April",
    summary:
      "Powder-white Caribbean sand, clifftop Mayan ruins, and jungle cenotes for swimming — bohemian beach life with ancient roots.",
    quickFacts: {
      bestMonths: "Nov–Apr",
      avgBudgetPerDay: "£60–100",
      language: "Spanish",
      currency: "Mexican Peso (MX$)",
    },
    sampleItinerary: [
      {
        morning: "Mayan ruins above the sea",
        afternoon: "Beach day on the Caribbean",
        evening: "Tacos and mezcal in town",
      },
      {
        morning: "Swim the Gran Cenote",
        afternoon: "Bike the beach road",
        evening: "Beach-club dinner under string lights",
      },
      {
        morning: "Sian Ka'an biosphere tour",
        afternoon: "Snorkel the lagoon",
        evening: "Live music on the sand",
      },
    ],
  },
  {
    slug: "isle-of-skye",
    name: "Isle of Skye",
    country: "Scotland",
    imageSeed: "skye-uk",
    moods: ["Adventure", "Budget"],
    bestTimeToVisit: "May–September",
    summary:
      "Brooding peaks, sea cliffs, and fairy pools — Skye is the Hebrides at their wild, mist-wrapped best.",
    quickFacts: {
      bestMonths: "May–Sep",
      avgBudgetPerDay: "£70–110",
      language: "English, Gaelic",
      currency: "Pound Sterling (£)",
    },
    sampleItinerary: [
      {
        morning: "Hike the Old Man of Storr",
        afternoon: "Kilt Rock and Mealt Falls",
        evening: "Pub dinner in Portree",
      },
      {
        morning: "Swim the Fairy Pools",
        afternoon: "Drive the Trotternish loop",
        evening: "Sunset at Neist Point lighthouse",
      },
      {
        morning: "Quiraing ridge walk",
        afternoon: "Talisker Distillery tour",
        evening: "Seafood by the harbour",
      },
    ],
  },
  {
    slug: "banff",
    name: "Banff",
    country: "Canada",
    imageSeed: "banff-ca",
    moods: ["Adventure"],
    bestTimeToVisit: "June–August & December–March (ski)",
    summary:
      "Turquoise glacial lakes beneath the Canadian Rockies — a national-park playground for hikers, paddlers, and skiers.",
    quickFacts: {
      bestMonths: "Jun–Aug, Dec–Mar (ski)",
      avgBudgetPerDay: "£90–140",
      language: "English, French",
      currency: "Canadian Dollar (C$)",
    },
    sampleItinerary: [
      {
        morning: "Canoe on Lake Louise",
        afternoon: "Moraine Lake and the Ten Peaks",
        evening: "Soak in the Banff Upper Hot Springs",
      },
      {
        morning: "Gondola up Sulphur Mountain",
        afternoon: "Explore Banff townsite",
        evening: "Dinner with mountain views",
      },
      {
        morning: "Drive the Icefields Parkway",
        afternoon: "Walk on the Athabasca Glacier",
        evening: "Wildlife spotting at dusk",
      },
    ],
  },
];

/** Look up a single destination by its slug. */
export function getDestination(slug: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.slug === slug);
}

// Destination photography now lives in src/lib/images.ts (curated Unsplash
// candidates in src/data/destinations/images.json, rendered through
// components/images/DestinationPhoto with a branded gradient fallback).

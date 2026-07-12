#!/usr/bin/env node
/**
 * fetch-destination-images.mjs
 * ---------------------------------------------------------------------------
 * Sources real destination photography candidates from the Unsplash API and
 * writes them to src/data/destinations/images.json for curation at
 * /dev/image-review (dev server). The site renders NOTHING from this file
 * until a human selects a winner per destination — automated first-result
 * selection is how sites end up with a photo of Barcelona on the Lisbon page.
 *
 * Query strategy: every destination has a hand-authored query that names the
 * place AND a signature landmark/characteristic ("Lisbon Alfama tram 28"),
 * because bare place names return generic results. Landscape orientation,
 * ordered by relevance, top 5 candidates that meet the resolution floor.
 *
 * Requirements:
 *   UNSPLASH_ACCESS_KEY in .env.local  (free tier: 50 requests/hour —
 *   the script rate-limits itself and caches, so re-runs only fetch
 *   destinations that have no candidates yet)
 *
 * Usage:
 *   node scripts/images/fetch-destination-images.mjs             # missing only
 *   node scripts/images/fetch-destination-images.mjs --force     # refetch all
 *   node scripts/images/fetch-destination-images.mjs --only lisbon,france
 * ---------------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT_FILE = path.join(ROOT, "src/data/destinations/images.json");

// Resolution floors (px wide). Never upscale: candidates below the card
// floor are dropped; between card and hero floor they're kept but flagged.
const HERO_MIN_WIDTH = 2000;
const CARD_MIN_WIDTH = 1200;
const CANDIDATES_PER_DESTINATION = 5;
// Fetch extra so the resolution filter still leaves 5.
const FETCH_PER_QUERY = 12;
// Free tier is 50 req/hour — stay well under it and be polite.
const RATE_DELAY_MS = 1500;

// ─── queries ─────────────────────────────────────────────────────────────────
// key → { query, alt } — the alt is the hand-authored fallback description
// of the intended scene (used when Unsplash's alt_description is missing).

const QUERIES = {
  // ── Curated seed destinations (src/data/destinations.ts) ──
  lisbon: {
    query: "Lisbon Portugal Alfama yellow tram 28 cobbled street",
    alt: "Yellow Tram 28 climbing a cobbled street in Alfama, Lisbon",
  },
  kyoto: {
    query: "Kyoto Japan Fushimi Inari vermilion torii gates path",
    alt: "Vermilion torii gates lining the path at Fushimi Inari, Kyoto",
  },
  bali: {
    query: "Bali Indonesia Tegallalang rice terraces sunrise palms",
    alt: "Terraced rice paddies at Tegallalang, Bali, in early light",
  },
  bangkok: {
    query: "Bangkok Thailand Wat Arun temple Chao Phraya sunset",
    alt: "Wat Arun temple on the Chao Phraya river at sunset, Bangkok",
  },
  cusco: {
    query: "Machu Picchu Peru citadel Andes morning mist",
    alt: "The citadel of Machu Picchu with Huayna Picchu rising behind",
  },
  dubrovnik: {
    query: "Dubrovnik Croatia old town city walls Adriatic rooftops",
    alt: "Dubrovnik's terracotta rooftops and city walls above the Adriatic",
  },
  hanoi: {
    query: "Hanoi Vietnam old quarter street lanterns motorbikes",
    alt: "A lantern-lit street in Hanoi's Old Quarter",
  },
  "isle-of-skye": {
    query: "Isle of Skye Scotland Old Man of Storr highlands",
    alt: "The Old Man of Storr rock pinnacle on the Isle of Skye",
  },
  banff: {
    query: "Banff Canada Moraine Lake turquoise Rocky Mountains",
    alt: "Turquoise Moraine Lake beneath the Valley of the Ten Peaks, Banff",
  },
  "maasai-mara": {
    query: "Maasai Mara Kenya savanna acacia tree safari sunset",
    alt: "A lone acacia on the Maasai Mara savanna at golden hour",
  },
  marrakech: {
    query: "Marrakech Morocco medina souk lanterns Jemaa el-Fnaa",
    alt: "Brass lanterns glowing in a Marrakech souk",
  },
  queenstown: {
    query: "Queenstown New Zealand Lake Wakatipu Remarkables mountains",
    alt: "Queenstown on Lake Wakatipu beneath the Remarkables range",
  },
  reykjavik: {
    query: "Reykjavik Iceland Hallgrimskirkja church colourful houses",
    alt: "Hallgrímskirkja church rising over Reykjavik's colourful rooftops",
  },
  santorini: {
    query: "Santorini Greece Oia blue domes white houses caldera",
    alt: "Blue-domed churches of Oia above the Santorini caldera",
  },
  tulum: {
    query: "Tulum Mexico Mayan ruins clifftop Caribbean beach",
    alt: "The Mayan ruins of Tulum on a cliff above the Caribbean",
  },
  "amalfi-coast": {
    query: "Positano Amalfi Coast Italy colourful cliffside village",
    alt: "Positano's pastel houses stacked above the Tyrrhenian Sea",
  },

  // ── Homepage trending / quick-pick extras ──
  crete: {
    query: "Crete Greece Balos lagoon turquoise beach",
    alt: "The turquoise shallows of Balos lagoon, Crete",
  },
  "mexico/mexico-city": {
    query: "Mexico City Palacio de Bellas Artes golden dome",
    alt: "Palacio de Bellas Artes and its amber dome, Mexico City",
  },
  "slovenia/ljubljana": {
    query: "Ljubljana Slovenia riverfront old town castle",
    alt: "Ljubljana's riverfront cafés beneath the castle hill",
  },
  "japan/tokyo": {
    query: "Tokyo Japan Shibuya crossing neon night",
    alt: "Shibuya crossing glowing at dusk, Tokyo",
  },
  "united-states/new-york-city": {
    query: "New York City Manhattan skyline Brooklyn Bridge dusk",
    alt: "The Manhattan skyline behind the Brooklyn Bridge at dusk",
  },

  // ── Guide countries (scripts/guides/top50.json) ──
  france: {
    query: "Paris France Eiffel Tower golden hour Seine",
    alt: "The Eiffel Tower above Haussmann rooftops at golden hour",
  },
  spain: {
    query: "Barcelona Spain Sagrada Familia Park Guell",
    alt: "Barcelona's skyline with the Sagrada Família",
  },
  italy: {
    query: "Rome Italy Colosseum sunrise ancient",
    alt: "The Colosseum in Rome at sunrise",
  },
  "united-states": {
    query: "Grand Canyon Arizona golden hour vista",
    alt: "The Grand Canyon glowing at golden hour",
  },
  japan: {
    query: "Mount Fuji Japan Chureito pagoda cherry blossom",
    alt: "Mount Fuji framed by the Chureito pagoda",
  },
  thailand: {
    query: "Thailand Phi Phi islands longtail boat limestone cliffs",
    alt: "A longtail boat in a turquoise bay beneath limestone cliffs, Thailand",
  },
  greece: {
    query: "Santorini Greece Oia caldera sunset white houses",
    alt: "Whitewashed Oia spilling down the Santorini caldera",
  },
  portugal: {
    query: "Lisbon Portugal Alfama rooftops miradouro river Tagus",
    alt: "Alfama's terracotta rooftops running down to the Tagus, Lisbon",
  },
  mexico: {
    query: "Chichen Itza Mexico Mayan pyramid El Castillo",
    alt: "El Castillo pyramid at Chichén Itzá",
  },
  indonesia: {
    query: "Bali Indonesia Pura Ulun Danu temple lake",
    alt: "Ulun Danu temple on Lake Bratan, Bali",
  },
  vietnam: {
    query: "Ha Long Bay Vietnam limestone karsts junk boat",
    alt: "Limestone karsts rising from Ha Long Bay",
  },
  croatia: {
    query: "Dubrovnik Croatia old town walls Adriatic sea",
    alt: "Dubrovnik old town jutting into the Adriatic",
  },
  turkey: {
    query: "Cappadocia Turkey hot air balloons sunrise fairy chimneys",
    alt: "Hot-air balloons drifting over Cappadocia at sunrise",
  },
  morocco: {
    query: "Marrakech Morocco medina courtyard riad lanterns",
    alt: "A sunlit riad courtyard in the Marrakech medina",
  },
  iceland: {
    query: "Iceland Kirkjufell mountain waterfall northern lights",
    alt: "Kirkjufell mountain and falls under a vivid sky, Iceland",
  },
  "united-kingdom": {
    query: "London Big Ben Westminster Thames dusk",
    alt: "Big Ben and Westminster across the Thames at dusk",
  },
  germany: {
    query: "Neuschwanstein Castle Bavaria Germany alps autumn",
    alt: "Neuschwanstein Castle above autumn forest in Bavaria",
  },
  netherlands: {
    query: "Amsterdam Netherlands canal houses bicycles evening",
    alt: "Gabled canal houses reflected in an Amsterdam canal",
  },
  switzerland: {
    query: "Matterhorn Zermatt Switzerland alpine reflection",
    alt: "The Matterhorn reflected in an alpine lake near Zermatt",
  },
  austria: {
    query: "Hallstatt Austria lakeside village alps",
    alt: "Hallstatt village on its lake beneath the Alps",
  },
  peru: {
    query: "Machu Picchu Peru Andes citadel morning",
    alt: "Machu Picchu emerging from morning cloud",
  },
  "costa-rica": {
    query: "Costa Rica Arenal volcano rainforest",
    alt: "Arenal volcano rising over Costa Rican rainforest",
  },
  "new-zealand": {
    query: "Milford Sound New Zealand fiord Mitre Peak",
    alt: "Mitre Peak over the still water of Milford Sound",
  },
  australia: {
    query: "Sydney Opera House harbour Australia dusk",
    alt: "The Sydney Opera House and harbour at dusk",
  },
  canada: {
    query: "Moraine Lake Banff Canada turquoise peaks",
    alt: "Canoes on turquoise Moraine Lake in the Canadian Rockies",
  },
  india: {
    query: "Taj Mahal Agra India sunrise reflection",
    alt: "The Taj Mahal mirrored in its reflecting pool at sunrise",
  },
  "sri-lanka": {
    query: "Sri Lanka Sigiriya rock fortress jungle",
    alt: "Sigiriya rock fortress rising from the jungle, Sri Lanka",
  },
  egypt: {
    query: "Pyramids Giza Egypt desert camel sunset",
    alt: "The pyramids of Giza against a desert sunset",
  },
  jordan: {
    query: "Petra Jordan Treasury Al-Khazneh canyon",
    alt: "The Treasury at Petra glimpsed from the Siq",
  },
  "south-africa": {
    query: "Cape Town South Africa Table Mountain coastline",
    alt: "Table Mountain looming over Cape Town's coastline",
  },
  kenya: {
    query: "Kenya Maasai Mara elephants savanna Kilimanjaro",
    alt: "Elephants crossing the savanna with Kilimanjaro beyond",
  },
  tanzania: {
    query: "Serengeti Tanzania wildebeest migration acacia",
    alt: "Wildebeest scattered across the Serengeti plain",
  },
  argentina: {
    query: "Patagonia Argentina Fitz Roy mountain glacier",
    alt: "Monte Fitz Roy's granite spires in Argentine Patagonia",
  },
  brazil: {
    query: "Rio de Janeiro Brazil Christ Redeemer Sugarloaf",
    alt: "Rio de Janeiro from Corcovado, Sugarloaf in the distance",
  },
  chile: {
    query: "Torres del Paine Chile Patagonia granite towers",
    alt: "The granite towers of Torres del Paine, Chile",
  },
  colombia: {
    query: "Cartagena Colombia colourful colonial old town balconies",
    alt: "Flower-draped balconies in Cartagena's walled old town",
  },
  cambodia: {
    query: "Angkor Wat Cambodia temple sunrise reflection",
    alt: "Angkor Wat mirrored in its moat at sunrise",
  },
  laos: {
    query: "Luang Prabang Laos Kuang Si waterfall turquoise",
    alt: "The turquoise tiers of Kuang Si falls near Luang Prabang",
  },
  philippines: {
    query: "Palawan Philippines El Nido lagoon limestone islands",
    alt: "An island lagoon in El Nido, Palawan",
  },
  malaysia: {
    query: "Kuala Lumpur Malaysia Petronas Towers night",
    alt: "The Petronas Towers lit against the night sky, Kuala Lumpur",
  },
  singapore: {
    query: "Singapore Marina Bay Sands Gardens by the Bay supertrees",
    alt: "Supertree Grove and Marina Bay Sands, Singapore",
  },
  "south-korea": {
    query: "Seoul South Korea Gyeongbokgung palace hanbok autumn",
    alt: "Gyeongbokgung palace with Bugaksan behind, Seoul",
  },
  china: {
    query: "Great Wall of China Mutianyu mountains autumn",
    alt: "The Great Wall snaking over ridgelines at Mutianyu",
  },
  "united-arab-emirates": {
    query: "Dubai Burj Khalifa skyline desert dusk",
    alt: "Dubai's skyline around the Burj Khalifa at dusk",
  },
  norway: {
    query: "Lofoten Norway fjord red cabins mountains",
    alt: "Red rorbu cabins beneath Lofoten's peaks, Norway",
  },
  sweden: {
    query: "Stockholm Sweden Gamla Stan old town waterfront",
    alt: "The ochre facades of Gamla Stan on Stockholm's waterfront",
  },
  ireland: {
    query: "Cliffs of Moher Ireland Atlantic ocean",
    alt: "The Cliffs of Moher dropping into the Atlantic",
  },
  "czech-republic": {
    query: "Prague Charles Bridge castle sunrise spires",
    alt: "Charles Bridge and Prague Castle in first light",
  },
  hungary: {
    query: "Budapest Hungary Parliament Danube night",
    alt: "The Hungarian Parliament reflected in the Danube at night",
  },
  poland: {
    query: "Krakow Poland old town market square St Mary's",
    alt: "Kraków's main market square and St Mary's Basilica",
  },
};

// ─── env / args ──────────────────────────────────────────────────────────────

loadEnv(path.join(ROOT, ".env.local"));
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY ?? "";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyRaw = args.find((_, i) => args[i - 1] === "--only");
const ONLY = onlyRaw
  ? new Set(onlyRaw.split(",").map((s) => s.trim().toLowerCase()))
  : null;

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Unsplash ────────────────────────────────────────────────────────────────

async function searchPhotos(query) {
  const u = new URL("https://api.unsplash.com/search/photos");
  u.searchParams.set("query", query);
  u.searchParams.set("orientation", "landscape");
  u.searchParams.set("per_page", String(FETCH_PER_QUERY));
  u.searchParams.set("order_by", "relevant");
  u.searchParams.set("content_filter", "high");

  const res = await fetch(u, {
    headers: {
      Authorization: `Client-ID ${ACCESS_KEY}`,
      "Accept-Version": "v1",
    },
  });

  if (res.status === 403) {
    throw new Error("RATE_LIMITED");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).results ?? [];
}

function toCandidate(photo) {
  return {
    id: photo.id,
    rawUrl: photo.urls.raw,
    fullUrl: photo.urls.full,
    regularUrl: photo.urls.regular,
    width: photo.width,
    height: photo.height,
    color: photo.color ?? "#E7DECB",
    alt: photo.alt_description ?? photo.description ?? null,
    photographer: photo.user?.name ?? "Unknown",
    photographerUrl: photo.user?.links?.html ?? "https://unsplash.com",
    photoUrl: photo.links?.html ?? "https://unsplash.com",
    downloadLocation: photo.links?.download_location ?? "",
  };
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!ACCESS_KEY) {
    console.error(
      "Error: UNSPLASH_ACCESS_KEY is not set in .env.local\n" +
        "Create a free app at https://unsplash.com/developers and add the key."
    );
    process.exit(1);
  }

  const existing = fs.existsSync(OUT_FILE)
    ? JSON.parse(fs.readFileSync(OUT_FILE, "utf8"))
    : {};

  const keys = Object.keys(QUERIES).filter(
    (k) => !ONLY || ONLY.has(k.toLowerCase())
  );

  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of keys) {
    const spec = QUERIES[key];

    // Cache: don't re-fetch (and never clobber a human's selection).
    if (!FORCE && existing[key]?.candidates?.length) {
      skipped++;
      continue;
    }

    process.stdout.write(`▸ ${key} — "${spec.query}" … `);
    try {
      const photos = await searchPhotos(spec.query);

      const candidates = photos
        .filter((p) => p.width >= CARD_MIN_WIDTH && !p.premium)
        .slice(0, CANDIDATES_PER_DESTINATION)
        .map(toCandidate);

      const heroReady = candidates.filter(
        (c) => c.width >= HERO_MIN_WIDTH
      ).length;

      existing[key] = {
        query: spec.query,
        defaultAlt: spec.alt,
        // Preserve a previous selection only if the same photo is still
        // in the same position; otherwise force re-review.
        selected:
          !FORCE &&
          existing[key]?.selected != null &&
          existing[key]?.candidates?.[existing[key].selected]?.id ===
            candidates[existing[key].selected]?.id
            ? existing[key].selected
            : null,
        candidates,
      };

      console.log(
        `${candidates.length} candidates (${heroReady} hero-ready ≥${HERO_MIN_WIDTH}px)`
      );
      fetched++;
    } catch (err) {
      if (err.message === "RATE_LIMITED") {
        console.log("rate limited — saving progress and stopping.");
        console.log(
          "  The free tier allows 50 requests/hour. Re-run this script in an hour;"
        );
        console.log(
          "  it will resume from where it stopped (results are cached)."
        );
        break;
      }
      console.log(`failed (${err.message})`);
      failed++;
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2) + "\n");
    await sleep(RATE_DELAY_MS);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(existing, null, 2) + "\n");

  const unreviewed = Object.entries(existing).filter(
    ([, e]) => e.candidates?.length && e.selected == null
  ).length;

  console.log("\n" + "─".repeat(60));
  console.log(`Fetched: ${fetched}   Cached: ${skipped}   Failed: ${failed}`);
  console.log(`Awaiting curation: ${unreviewed} destinations`);
  console.log(
    "\nNext: run `npm run dev` and open http://localhost:3000/dev/image-review"
  );
  console.log("to pick the winning photo for each destination BY EYE.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

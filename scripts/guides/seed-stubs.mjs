#!/usr/bin/env node
/**
 * seed-stubs.mjs
 * ---------------------------------------------------------------------------
 * Creates minimal stub MDX files for every country in top50.json that does
 * not already have a guide in src/content/guides/{slug}.mdx.
 *
 * Stubs are valid, renderable pages with real frontmatter (populated from
 * countries.json) and placeholder prose sections.  Run `npm run generate:guides`
 * to replace them with AI-written content.
 *
 * Usage:
 *   node scripts/guides/seed-stubs.mjs             # skips existing files
 *   node scripts/guides/seed-stubs.mjs --force     # overwrites existing
 * ---------------------------------------------------------------------------
 */

import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../..');

const TOP50_FILE    = path.join(__dirname, 'top50.json');
const COUNTRIES_SRC = path.join(ROOT, 'src/data/destinations/countries.json');
const GUIDES_DIR    = path.join(ROOT, 'src/content/guides');

const FORCE = process.argv.includes('--force');

// ─── helpers ────────────────────────────────────────────────────────────────

function escYaml(s) {
  return String(s ?? '').replace(/"/g, '\\"');
}

// ─── stub template ────────────────────────────────────────────────────────────

function makeFrontmatter(meta, country) {
  const today = new Date().toISOString().slice(0, 10);
  const description =
    `Everything you need to plan a trip to ${country.name}: visa rules, best time to visit, where to go, budget tips, and sample itineraries.`.slice(0, 155);

  const currency = [meta.currency, meta.currencySymbol ? `(${meta.currencySymbol})` : ''].filter(Boolean).join(' ');

  return [
    '---',
    `title: "${escYaml(country.name)} Travel Guide"`,
    `description: "${escYaml(description)}"`,
    `country: "${escYaml(country.name)}"`,
    `slug: "${escYaml(country.slug)}"`,
    `heroImage: ""`,
    `lastUpdated: "${today}"`,
    `quickFacts:`,
    `  capital: "${escYaml(meta.capital ?? '')}"`,
    `  currency: "${escYaml(currency)}"`,
    `  language: ""`,
    `  bestMonths: ""`,
    `  budgetPerDay: null`,
    `  visaSummary: "Check official government sources for the latest entry requirements."`,
    '---',
    '',
  ].join('\n');
}

function makeContent(meta, country) {
  const name    = country.name;
  const capital = meta.capital ?? `the capital`;
  const sub     = meta.subregion ?? meta.region ?? 'the region';

  return `\
## Why Visit

${name} is one of the world's most compelling travel destinations, situated in ${sub}. Visitors are drawn by its distinctive landscapes, rich cultural heritage, and experiences that are difficult to replicate anywhere else. Whether you're after history, adventure, gastronomy, or simply somewhere new to explore, ${name} rewards curious travellers.

## Best Time to Visit

The ideal time to visit ${name} depends on the region and the kind of experience you're after. Spring and early autumn generally offer mild weather and thinner crowds at major sights. Summers can be busy but festive, while winter months bring their own character to the country. Researching local weather patterns and any major festivals before you book will help you time your trip well.

## How Long to Stay

A week in ${name} gives you enough time to explore ${capital} and one or two other areas. Travellers looking to go beyond the highlights typically spend two weeks or more, allowing for slower travel, day trips, and the kind of unplanned discoveries that make a trip memorable.

## Getting In

${capital} is the main international gateway to ${name}, though several regional airports also serve international routes. Check current visa requirements through your government's official travel advisory before booking — entry rules vary significantly by nationality and are subject to change.

## Getting Around

${name} is served by a mix of domestic flights, long-distance coaches, and rail services depending on the region. Renting a car is popular for rural exploration and areas poorly connected by public transport. Ride-sharing and local taxis are widely available in urban centres.

## Budget

${name} suits travellers across a wide range of budgets. Costs for accommodation, food, and transport vary between regions, with cities generally more expensive than rural areas. Eating at local restaurants and markets tends to offer both better value and a more authentic experience than tourist-facing establishments.

## Where to Go

${capital} is the natural starting point, offering the highest concentration of cultural attractions, restaurants, and transport links. Beyond the capital, ${name} rewards those who venture further — distinct regions each offer their own landscapes and character that contrast with the main city experience.

## Sample Itineraries

**5-Day Trip**

Day 1: Arrive in ${capital}. Settle in and explore the city centre on foot — markets, main squares, and a local dinner.
Day 2: Museums, galleries, or historic sites; an evening neighbourhood walk.
Day 3: Day trip to a nearby town, coast, or nature area.
Day 4: A second district or cultural experience; local cooking or craft.
Day 5: Final morning in ${capital} before departure.

**10-Day Trip**

Days 1–3: ${capital} in depth — culture, food, and day trips.
Days 4–5: Head to a second region by train or coach.
Days 6–7: Coastal or rural area; slower pace.
Days 8–9: A third destination or national park.
Day 10: Return to ${capital} for departure.

## Food & Drink

${name}'s cuisine reflects its geography and history, with marked regional variation. The best way to discover local food is to eat where locals eat — neighbourhood restaurants, covered markets, and street stalls over tourist-facing venues. The country's drink culture — whether coffee, tea, wine, beer, or local spirits — is worth exploring on its own terms.

## Culture & Etiquette

Visitors to ${name} will find that respectful curiosity goes a long way. Dress modestly when visiting religious sites, and ask before photographing people. Tipping customs vary — a small amount is usually appreciated at sit-down restaurants, but check local norms. Learning a few words of greeting in the local language is almost always well received.

## Common Mistakes

First-time visitors to ${name} often make a handful of avoidable errors. Being aware of them in advance will make your trip smoother.

- Trying to cover too many places in too short a time — quality over quantity
- Staying only in ${capital} and missing the wider country
- Not booking popular attractions or transport in advance during peak season
- Exchanging money at airports, where rates are rarely competitive
- Underestimating journey times between cities
- Forgetting to check visa and entry requirements well before departure
`;
}

// ─── main ────────────────────────────────────────────────────────────────────

const top50     = JSON.parse(fs.readFileSync(TOP50_FILE, 'utf8'));
const countries = JSON.parse(fs.readFileSync(COUNTRIES_SRC, 'utf8'));
const byId      = Object.fromEntries(countries.map(c => [c.id, c]));

if (!fs.existsSync(GUIDES_DIR)) fs.mkdirSync(GUIDES_DIR, { recursive: true });

let created = 0, skipped = 0;

for (const entry of top50) {
  const outFile = path.join(GUIDES_DIR, `${entry.slug}.mdx`);

  if (!FORCE && fs.existsSync(outFile)) {
    console.log(`  – ${entry.name} — already exists`);
    skipped++;
    continue;
  }

  const meta = byId[entry.id];
  if (!meta) {
    console.warn(`  ⚠ No metadata for ${entry.id} in countries.json — skipping`);
    continue;
  }

  const frontmatter = makeFrontmatter(meta, entry);
  const content     = makeContent(meta, entry);
  fs.writeFileSync(outFile, frontmatter + content, 'utf8');
  console.log(`  ✓ ${entry.name}`);
  created++;
}

console.log(`\nDone. Created: ${created}, skipped: ${skipped}.`);

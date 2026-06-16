#!/usr/bin/env node
/**
 * generate-destinations.mjs
 * ---------------------------------------------------------------------------
 * Generates the full list of countries and cities for the travel planner's
 * "Search destinations" feature.
 *
 * Data source: dr5hn/countries-states-cities-database (CC-BY 4.0, ~156k cities)
 *
 * It produces THREE files in ./src/data/destinations/ :
 *
 *   1. countries.json        — all 248 countries with metadata (always bundled)
 *   2. cities.major.json     — curated ~7k cities (capital + top N per country)
 *                              small enough to search instantly in the browser
 *   3. cities.full.json      — every city (~156k), for seeding a database /
 *                              powering server-side autocomplete. NOT meant to
 *                              be imported into the client bundle.
 *
 * Usage:
 *   node generate-destinations.mjs                 # default: 40 cities/country in "major"
 *   node generate-destinations.mjs --max 60        # change curated cap
 *   node generate-destinations.mjs --no-full       # skip the 156k-city file
 * ---------------------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// --- config ----------------------------------------------------------------
const REPO = 'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json';
const SRC_COUNTRIES = `${REPO}/countries.json`;
const SRC_CITIES    = `${REPO}/countries%2Bcities.json`; // countries+cities.json

const OUT_DIR = path.resolve('src/data/destinations');

const args = process.argv.slice(2);
const MAX_MAJOR = Number(args[args.indexOf('--max') + 1]) || 40;
const WRITE_FULL = !args.includes('--no-full');

// --- helpers ----------------------------------------------------------------
const log = (...m) => console.log('▸', ...m);

const slugify = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function fetchJson(url, label) {
  log(`Downloading ${label}…`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to fetch ${label}: HTTP ${res.status}`);
  const data = await res.json();
  log(`  ✓ ${label}: ${Array.isArray(data) ? data.length : '?'} records`);
  return data;
}

// --- main -------------------------------------------------------------------
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const [rawCountries, rawCC] = await Promise.all([
    fetchJson(SRC_COUNTRIES, 'countries'),
    fetchJson(SRC_CITIES, 'countries+cities'),
  ]);

  // name -> [cityName, ...]
  const cityMap = new Map(rawCC.map((c) => [c.name, c.cities || []]));

  // ---- 1. countries.json ---------------------------------------------------
  const countries = rawCountries
    .map((c) => ({
      id: c.iso2,
      name: c.name,
      slug: slugify(c.name),
      capital: c.capital || null,
      region: c.region || 'Other',
      subregion: c.subregion || null,
      currency: c.currency || null,
      currencySymbol: c.currency_symbol || null,
      flag: c.emoji || null,
      lat: c.latitude ? +(+c.latitude).toFixed(4) : null,
      lng: c.longitude ? +(+c.longitude).toFixed(4) : null,
      cityCount: (cityMap.get(c.name) || []).length,
    }))
    // drop entries with no region AND no cities (a few uninhabited territories)
    .filter((c) => c.region !== 'Other' || c.cityCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(
    path.join(OUT_DIR, 'countries.json'),
    JSON.stringify(countries, null, 0)
  );
  log(`Wrote countries.json (${countries.length} countries)`);

  // ---- 2. cities.major.json (curated, client-safe) ------------------------
  // Each city row is kept tiny: [name, countryId, slug]. The capital is always
  // included first; the rest are taken in source order up to MAX_MAJOR.
  const major = [];
  for (const c of countries) {
    const all = cityMap.get(c.name) || [];
    const picked = new Set();

    if (c.capital && all.includes(c.capital)) picked.add(c.capital);
    for (const name of all) {
      if (picked.size >= MAX_MAJOR) break;
      picked.add(name);
    }
    for (const name of picked) {
      major.push({
        name,
        countryId: c.id,
        country: c.name,
        slug: `${c.slug}/${slugify(name)}`,
        isCapital: name === c.capital,
      });
    }
  }
  major.sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(
    path.join(OUT_DIR, 'cities.major.json'),
    JSON.stringify(major, null, 0)
  );
  log(`Wrote cities.major.json (${major.length} cities, max ${MAX_MAJOR}/country)`);

  // ---- 3. cities.full.json (everything, for DB seed) ----------------------
  if (WRITE_FULL) {
    const full = [];
    for (const c of countries) {
      for (const name of cityMap.get(c.name) || []) {
        full.push({ name, countryId: c.id });
      }
    }
    fs.writeFileSync(
      path.join(OUT_DIR, 'cities.full.json'),
      JSON.stringify(full, null, 0)
    );
    const mb = (fs.statSync(path.join(OUT_DIR, 'cities.full.json')).size / 1e6).toFixed(1);
    log(`Wrote cities.full.json (${full.length} cities, ${mb} MB)`);
    log('  ⚠  Do NOT import this in the client bundle — seed it into your DB instead.');
  }

  // ---- summary -------------------------------------------------------------
  const byRegion = {};
  for (const c of countries) byRegion[c.region] = (byRegion[c.region] || 0) + 1;
  log('Done. Countries by region:');
  for (const [r, n] of Object.entries(byRegion).sort()) console.log(`     ${r}: ${n}`);
}

main().catch((err) => {
  console.error('\n✗ Generation failed:', err.message);
  process.exit(1);
});

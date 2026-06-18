#!/usr/bin/env node
/**
 * fetch-country-data.mjs
 * ---------------------------------------------------------------------------
 * Builds one grounded data file per country for the top-50 travel destinations.
 * Output: scripts/guides/data/{slug}.json
 *
 * Data sources:
 *   1. src/data/destinations/countries.json  — base metadata (always available)
 *   2. src/data/destinations/cities.major.json — curated city list (always available)
 *   3. Geoapify Places API (free tier, 3 000 req/day)
 *        Docs:  https://apidocs.geoapify.com/
 *        Key:   GEOAPIFY_KEY in .env.local
 *   4. Visa requirements API
 *        This script expects a REST endpoint that follows the shape:
 *          GET {VISA_API_URL}/visa?from={passportCode}&to={destinationCode}
 *          → { requirement, duration, notes, portal_url }
 *        Adjust VISA_ENDPOINT_TEMPLATE below if your provider uses a different path.
 *        Key:   VISA_API_KEY in .env.local
 *        URL:   VISA_API_URL  in .env.local  (base URL, no trailing slash)
 *
 * Usage:
 *   node scripts/guides/fetch-country-data.mjs            # skips existing files
 *   node scripts/guides/fetch-country-data.mjs --force    # re-fetches everything
 *   node scripts/guides/fetch-country-data.mjs --only FR,JP  # specific countries
 * ---------------------------------------------------------------------------
 */

import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../..');

// ─── config ─────────────────────────────────────────────────────────────────

const TOP50_FILE    = path.join(__dirname, 'top50.json');
const COUNTRIES_SRC = path.join(ROOT, 'src/data/destinations/countries.json');
const CITIES_SRC    = path.join(ROOT, 'src/data/destinations/cities.major.json');
const DATA_DIR      = path.join(__dirname, 'data');

// POIs: fetch for capital + up to this many other cities
const MAX_POI_CITIES = 2;
// Places per city (Geoapify limit per request)
const POI_LIMIT = 15;
// Radius around city centre in metres
const POI_RADIUS_M = 12_000;
// Passports we request visa info for
const PASSPORTS = ['US', 'GB', 'EU', 'CA', 'AU'];
// Milliseconds between API requests (stay within free-tier rate limits)
const RATE_DELAY_MS = 300;

// Geoapify category filter — tourism sights + attractions
const GEOAPIFY_CATEGORIES = 'tourism.sights,tourism.attraction';

// ─── env / args ─────────────────────────────────────────────────────────────

loadEnv(path.join(ROOT, '.env.local'));

const GEOAPIFY_KEY  = process.env.GEOAPIFY_KEY  ?? '';
const VISA_API_KEY  = process.env.VISA_API_KEY  ?? '';
const VISA_API_URL  = (process.env.VISA_API_URL ?? '').replace(/\/$/, '');

const args   = process.argv.slice(2);
const FORCE  = args.includes('--force');
const onlyRaw = args.find((_, i) => args[i - 1] === '--only');
const ONLY   = onlyRaw ? new Set(onlyRaw.split(',').map(s => s.trim().toUpperCase())) : null;

// ─── helpers ────────────────────────────────────────────────────────────────

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function log(icon, ...msg)  { console.log(icon, ...msg); }
function info(...msg)        { log('  ▸', ...msg); }
function ok(...msg)          { log('  ✓', ...msg); }
function warn(...msg)        { log('  ⚠', ...msg); }
function skip(...msg)        { log('  –', ...msg); }

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Fetch JSON with a timeout; returns null on any error. */
async function fetchJson(urlStr, headers = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(urlStr, { signal: controller.signal, headers });
    clearTimeout(tid);
    if (!res.ok) {
      warn(`HTTP ${res.status} for ${urlStr}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    clearTimeout(tid);
    warn(`Fetch failed for ${urlStr}: ${err.message}`);
    return null;
  }
}

// ─── Geoapify ────────────────────────────────────────────────────────────────

/**
 * Geocode a city name within a country to get lat/lng.
 * Returns { lat, lng } or null.
 */
async function geocodeCity(cityName, countryName) {
  if (!GEOAPIFY_KEY) return null;
  const q = encodeURIComponent(`${cityName}, ${countryName}`);
  const u = `https://api.geoapify.com/v1/geocode/search?text=${q}&limit=1&apiKey=${GEOAPIFY_KEY}`;
  const data = await fetchJson(u);
  await sleep(RATE_DELAY_MS);
  const feat = data?.features?.[0];
  if (!feat) return null;
  const [lng, lat] = feat.geometry.coordinates;
  return { lat, lng };
}

/**
 * Fetch tourism POIs near a lat/lng using Geoapify Places API.
 * Returns an array of { name, lat, lng, categories } (up to POI_LIMIT entries).
 */
async function fetchPOIs(lat, lng) {
  if (!GEOAPIFY_KEY) return [];
  const filter = `circle:${lng},${lat},${POI_RADIUS_M}`;
  const u = [
    `https://api.geoapify.com/v2/places`,
    `?categories=${GEOAPIFY_CATEGORIES}`,
    `&filter=${encodeURIComponent(filter)}`,
    `&limit=${POI_LIMIT}`,
    `&apiKey=${GEOAPIFY_KEY}`,
  ].join('');
  const data = await fetchJson(u);
  await sleep(RATE_DELAY_MS);
  if (!data?.features?.length) return [];
  return data.features
    .filter(f => f.properties?.name)
    .map(f => ({
      name:       f.properties.name,
      lat:        Math.round(f.geometry.coordinates[1] * 1e5) / 1e5,
      lng:        Math.round(f.geometry.coordinates[0] * 1e5) / 1e5,
      categories: f.properties.categories ?? [],
    }));
}

// ─── Visa API ────────────────────────────────────────────────────────────────

/**
 * Fetch visa requirement for one passport → destination pair.
 * Returns { requirement, duration, notes, portal_url } or a sentinel on failure.
 *
 * CONFIGURE: adjust the URL template and response field names to match your
 * actual visa API provider.  The template below assumes:
 *   GET {VISA_API_URL}/visa?from={passport}&to={destination}
 *   Response: { requirement, duration, notes, portal_url }
 *
 * If VISA_API_URL or VISA_API_KEY are not set, returns { _unavailable: "missing_key" }.
 */
async function fetchVisaRule(passportCode, destinationCode) {
  if (!VISA_API_URL || !VISA_API_KEY) {
    return { _unavailable: 'missing_key' };
  }
  const u = `${VISA_API_URL}/visa?from=${passportCode}&to=${destinationCode}`;
  const data = await fetchJson(u, { Authorization: `Bearer ${VISA_API_KEY}` });
  await sleep(RATE_DELAY_MS);
  if (!data) return { _unavailable: 'api_error' };
  return {
    requirement: data.requirement ?? 'check official sources',
    duration:    data.duration    ?? null,
    notes:       data.notes       ?? null,
    portal_url:  data.portal_url  ?? null,
  };
}

/**
 * Fetch visa rules for all configured passports for a destination country.
 */
async function fetchAllVisaRules(destinationCode) {
  const result = {};
  for (const passport of PASSPORTS) {
    if (passport === destinationCode) {
      // Trivially not applicable — citizen of destination.
      result[passport] = { requirement: 'citizen', duration: null, notes: null, portal_url: null };
      continue;
    }
    result[passport] = await fetchVisaRule(passport, destinationCode);
  }
  return result;
}

// ─── POI orchestration ───────────────────────────────────────────────────────

/**
 * For a country, collect POIs for the capital and up to MAX_POI_CITIES other
 * major cities.  Returns { cityName: [ POI, … ] } or {} if Geoapify key missing.
 */
async function fetchCountryPOIs(countryMeta, citiesList) {
  if (!GEOAPIFY_KEY) {
    warn('GEOAPIFY_KEY not set — skipping POIs');
    return { _unavailable: 'missing_key' };
  }

  const pois = {};
  // Capital first, then other cities (de-duped)
  const capitalName = countryMeta.capital;
  const others = citiesList
    .filter(c => c.name !== capitalName)
    .slice(0, MAX_POI_CITIES);
  const targets = capitalName
    ? [{ name: capitalName, isCapital: true }, ...others.map(c => ({ name: c.name, isCapital: false }))]
    : others.map(c => ({ name: c.name, isCapital: false }));

  for (const { name } of targets) {
    info(`  Geocoding ${name}, ${countryMeta.name}…`);
    const coords = await geocodeCity(name, countryMeta.name);
    if (!coords) {
      warn(`  Could not geocode ${name}`);
      pois[name] = [];
      continue;
    }
    info(`  Fetching POIs near ${name} (${coords.lat}, ${coords.lng})…`);
    const places = await fetchPOIs(coords.lat, coords.lng);
    ok(`  ${name}: ${places.length} POIs`);
    pois[name] = places;
  }

  return pois;
}

// ─── city selection ──────────────────────────────────────────────────────────

/**
 * Pull all cities for a country from our local dataset.
 * Puts the capital first, then capitals of regions/territories, then alpha.
 */
function selectCities(countryId, capitalName, allCities) {
  const pool = allCities.filter(c => c.countryId === countryId);
  pool.sort((a, b) => {
    if (a.name === capitalName) return -1;
    if (b.name === capitalName) return  1;
    if (a.isCapital && !b.isCapital) return -1;
    if (!a.isCapital && b.isCapital) return  1;
    return a.name.localeCompare(b.name);
  });
  return pool;
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  // Load static sources
  const top50      = JSON.parse(fs.readFileSync(TOP50_FILE,    'utf8'));
  const countries  = JSON.parse(fs.readFileSync(COUNTRIES_SRC, 'utf8'));
  const allCities  = JSON.parse(fs.readFileSync(CITIES_SRC,    'utf8'));

  const countryById = Object.fromEntries(countries.map(c => [c.id, c]));

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!GEOAPIFY_KEY) warn('GEOAPIFY_KEY not set — POI data will be skipped');
  if (!VISA_API_KEY) warn('VISA_API_KEY / VISA_API_URL not set — visa data will be skipped');

  const summary = { fetched: [], skipped: [], failed: [] };

  for (const entry of top50) {
    if (ONLY && !ONLY.has(entry.id)) continue;

    const outFile = path.join(DATA_DIR, `${entry.slug}.json`);

    if (!FORCE && fs.existsSync(outFile)) {
      skip(`${entry.name} — already exists (pass --force to refresh)`);
      summary.skipped.push(entry.id);
      continue;
    }

    log('\n🌍', `${entry.name} (${entry.id})`);

    try {
      const meta = countryById[entry.id];
      if (!meta) {
        warn(`No metadata found for ${entry.id} in countries.json — skipping`);
        summary.failed.push(entry.id);
        continue;
      }

      // 1. Cities from local dataset
      const cities = selectCities(entry.id, meta.capital, allCities);
      info(`Cities from local data: ${cities.length}`);

      // 2. Visa rules
      info('Fetching visa rules…');
      const visa = await fetchAllVisaRules(entry.id);
      const visaStatuses = Object.entries(visa)
        .map(([p, v]) => `${p}:${v.requirement ?? v._unavailable}`)
        .join(', ');
      ok(`Visa: ${visaStatuses}`);

      // 3. POIs
      info('Fetching points of interest…');
      const pointsOfInterest = await fetchCountryPOIs(meta, cities);

      // 4. Assemble output
      const record = {
        id:              meta.id,
        name:            meta.name,
        slug:            meta.slug,
        flag:            meta.flag,
        capital:         meta.capital,
        region:          meta.region,
        subregion:       meta.subregion,
        currency:        meta.currency,
        currencySymbol:  meta.currencySymbol,
        lat:             meta.lat,
        lng:             meta.lng,
        cityCount:       meta.cityCount,
        cities:          cities.map(c => ({
          name:      c.name,
          slug:      c.slug,
          isCapital: c.isCapital,
        })),
        visa,
        pointsOfInterest,
        // Filled in by a later script that queries Numbeo for cost-of-living data.
        budget_per_day: null,
        fetched_at: new Date().toISOString(),
      };

      fs.writeFileSync(outFile, JSON.stringify(record, null, 2), 'utf8');
      ok(`Written → ${path.relative(ROOT, outFile)}`);
      summary.fetched.push(entry.id);

    } catch (err) {
      warn(`Unexpected error for ${entry.name}: ${err.message}`);
      summary.failed.push(entry.id);
    }
  }

  // ── summary ──────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('Summary');
  console.log('─'.repeat(60));
  console.log(`  Fetched : ${summary.fetched.length}  [${summary.fetched.join(', ')}]`);
  console.log(`  Skipped : ${summary.skipped.length}  [${summary.skipped.join(', ')}]`);
  console.log(`  Failed  : ${summary.failed.length}  [${summary.failed.join(', ')}]`);

  if (summary.failed.length) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

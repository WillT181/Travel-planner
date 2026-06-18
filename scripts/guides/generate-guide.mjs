#!/usr/bin/env node
/**
 * generate-guide.mjs
 * ---------------------------------------------------------------------------
 * Turns one or more grounded country data files (scripts/guides/data/{slug}.json)
 * into full MDX travel guides at src/content/guides/{slug}.mdx.
 *
 * Each of the 11 guide sections is generated with a separate Claude call so
 * the model receives only the facts relevant to that section.  A strict
 * grounding instruction prevents hallucination of visa rules, prices, or dates.
 *
 * Prerequisites:
 *   - Run `npm run fetch:guides` to produce scripts/guides/data/*.json first.
 *   - ANTHROPIC_API_KEY in .env.local
 *
 * Usage:
 *   node scripts/guides/generate-guide.mjs                 # all available data files
 *   node scripts/guides/generate-guide.mjs --force         # re-generate existing files
 *   node scripts/guides/generate-guide.mjs --only FR,JP    # specific countries by id
 *   node scripts/guides/generate-guide.mjs --slug france   # by slug
 * ---------------------------------------------------------------------------
 */

import fs   from 'node:fs';
import path from 'node:path';
import url  from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../..');

// ─── paths ──────────────────────────────────────────────────────────────────

const DATA_DIR   = path.join(__dirname, 'data');
const OUTPUT_DIR = path.join(ROOT, 'src/content/guides');

// ─── model ──────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';

// ─── env / args ─────────────────────────────────────────────────────────────

loadEnv(path.join(ROOT, '.env.local'));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

const args     = process.argv.slice(2);
const FORCE    = args.includes('--force');
const onlyRaw  = args.find((_, i) => args[i - 1] === '--only');
const slugRaw  = args.find((_, i) => args[i - 1] === '--slug');
const ONLY_IDS = onlyRaw ? new Set(onlyRaw.split(',').map(s => s.trim().toUpperCase())) : null;
const ONLY_SLUG = slugRaw ? slugRaw.trim().toLowerCase() : null;

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

// ─── grounding instruction ───────────────────────────────────────────────────

const GROUNDING =
  'Use only the facts provided in the data below. ' +
  'If a fact is not in the data, write generally without inventing specifics. ' +
  'Never state a visa rule, price, or date that is not in the supplied data. ' +
  'Write in an engaging, practical travel-guide style. ' +
  'Output plain prose — no extra headings, no bullet introduction, no markdown preamble.';

// ─── section definitions ─────────────────────────────────────────────────────

/**
 * Each section produces one MDX `## Heading` block.
 * `dataFn(d)` extracts the slice of grounded data relevant to that section.
 * `prompt(d, dataStr)` builds the user message.
 */
const SECTIONS = [
  {
    id:     'why-visit',
    heading: 'Why Visit',
    dataFn: d => ({ name: d.name, region: d.region, subregion: d.subregion, capital: d.capital }),
    prompt: (d, dataStr) =>
      `Write a 2–3 paragraph "Why Visit" introduction for ${d.name}. ` +
      `Capture what makes it special as a travel destination — landscape, culture, vibe — ` +
      `without listing generic bullet points. Data:\n\n${dataStr}`,
  },
  {
    id:     'best-time',
    heading: 'Best Time to Visit',
    dataFn: d => ({ name: d.name, region: d.region, subregion: d.subregion }),
    prompt: (d, dataStr) =>
      `Write a concise "Best Time to Visit" section for ${d.name}. ` +
      `Cover seasonal weather patterns, peak vs shoulder vs off-season trade-offs, and ` +
      `note any major festivals or events worth timing a trip around (only if you can name them confidently for this region). ` +
      `Keep it to 2 short paragraphs. Data:\n\n${dataStr}`,
  },
  {
    id:     'how-long',
    heading: 'How Long to Stay',
    dataFn: d => ({ name: d.name, cityCount: d.cityCount, cities: d.cities?.slice(0, 10) }),
    prompt: (d, dataStr) =>
      `Write a brief "How Long to Stay" section for ${d.name}. ` +
      `Suggest realistic trip lengths for different types of travellers (quick visit, standard holiday, slow travel). ` +
      `Mention a few headline destinations from the cities list if they are well-known, otherwise speak generally. ` +
      `Keep it to one paragraph. Data:\n\n${dataStr}`,
  },
  {
    id:     'getting-in',
    heading: 'Getting In',
    dataFn: d => ({ name: d.name, capital: d.capital, visa: d.visa }),
    prompt: (d, dataStr) => {
      const hasVisa = d.visa && !d.visa._unavailable &&
        Object.values(d.visa).some(v => !v._unavailable);
      const visaNote = hasVisa
        ? 'Visa data is provided — reference it precisely for each passport listed.'
        : 'No visa data is available — write only general advice without inventing specific rules.';
      return (
        `Write a "Getting In" section for ${d.name} covering entry requirements and main arrival airports or border crossings. ` +
        visaNote + ' ' +
        `Also mention the main international airport(s) if you can name them confidently for this country. ` +
        `Keep it to 2 paragraphs. Data:\n\n${dataStr}`
      );
    },
  },
  {
    id:     'getting-around',
    heading: 'Getting Around',
    dataFn: d => ({ name: d.name, region: d.region, subregion: d.subregion, cities: d.cities?.slice(0, 8) }),
    prompt: (d, dataStr) =>
      `Write a practical "Getting Around" section for ${d.name}. ` +
      `Cover the main transport options (domestic flights, trains, buses, car hire, taxis/rideshare) ` +
      `and their relative convenience and cost tier — without quoting specific prices. ` +
      `Keep it to 2 paragraphs. Data:\n\n${dataStr}`,
  },
  {
    id:     'budget',
    heading: 'Budget',
    dataFn: d => ({ name: d.name, currency: d.currency, currencySymbol: d.currencySymbol, budget_per_day: d.budget_per_day }),
    prompt: (d, dataStr) => {
      const hasBudget = d.budget_per_day !== null && d.budget_per_day !== undefined;
      const budgetNote = hasBudget
        ? `The budget_per_day field is provided — use it as the anchor.`
        : `No budget_per_day data is available — give only relative cost tiers (budget / mid-range / splurge) without specific numbers.`;
      return (
        `Write a "Budget" section for ${d.name}. ` +
        budgetNote + ' ' +
        `Cover accommodation, food, transport, and activities in broad terms. ` +
        `Mention the local currency. Keep it to 2 paragraphs. Data:\n\n${dataStr}`
      );
    },
  },
  {
    id:     'where-to-go',
    heading: 'Where to Go',
    dataFn: d => ({
      name:             d.name,
      capital:          d.capital,
      cities:           d.cities?.slice(0, 12),
      pointsOfInterest: d.pointsOfInterest && !d.pointsOfInterest._unavailable
                          ? d.pointsOfInterest
                          : null,
    }),
    prompt: (d, dataStr) => {
      const hasPOIs = d.pointsOfInterest && !d.pointsOfInterest._unavailable;
      const poiNote = hasPOIs
        ? 'Points of interest data is provided — incorporate named POIs naturally.'
        : 'No POI data is available — mention well-known landmarks only if you are highly confident they exist in this country.';
      return (
        `Write a "Where to Go" section for ${d.name} covering the key regions and cities worth visiting. ` +
        poiNote + ' ' +
        `Organise naturally (capital first, then other regions). Keep it to 3–4 paragraphs. Data:\n\n${dataStr}`
      );
    },
  },
  {
    id:     'itineraries',
    heading: 'Sample Itineraries',
    dataFn: d => ({
      name:    d.name,
      capital: d.capital,
      cities:  d.cities?.slice(0, 10),
      pointsOfInterest: d.pointsOfInterest && !d.pointsOfInterest._unavailable
                          ? d.pointsOfInterest
                          : null,
    }),
    prompt: (d, dataStr) =>
      `Write a "Sample Itineraries" section for ${d.name} with two concrete day-by-day plans: ` +
      `one for a 5-day trip and one for a 10-day trip. ` +
      `Use day headings like "Day 1:", "Day 2:", etc. ` +
      `Only name places you are confident are in ${d.name}. ` +
      `Keep each itinerary tight and practical. Data:\n\n${dataStr}`,
  },
  {
    id:     'food',
    heading: 'Food & Drink',
    dataFn: d => ({ name: d.name, region: d.region, subregion: d.subregion }),
    prompt: (d, dataStr) =>
      `Write a "Food & Drink" section for ${d.name}. ` +
      `Describe the cuisine character, must-try dishes and drinks, and dining culture. ` +
      `Only name dishes you are confident are traditional to this country. ` +
      `Keep it to 2 paragraphs. Data:\n\n${dataStr}`,
  },
  {
    id:     'culture',
    heading: 'Culture & Etiquette',
    dataFn: d => ({ name: d.name, region: d.region, subregion: d.subregion }),
    prompt: (d, dataStr) =>
      `Write a "Culture & Etiquette" section for ${d.name}. ` +
      `Cover social norms, dress codes, tipping, photography etiquette, and any taboos travellers should respect. ` +
      `Only assert specific norms you are confident apply to this country. ` +
      `Keep it to 2 paragraphs. Data:\n\n${dataStr}`,
  },
  {
    id:     'mistakes',
    heading: 'Common Mistakes',
    dataFn: d => ({ name: d.name, region: d.region, subregion: d.subregion, capital: d.capital }),
    prompt: (d, dataStr) =>
      `Write a "Common Mistakes" section for ${d.name} — a practical list of pitfalls first-time visitors make. ` +
      `Format as a short prose paragraph followed by 4–6 concise bullet points starting with a dash (-). ` +
      `Only reference specific mistakes relevant to this country. Data:\n\n${dataStr}`,
  },
];

// ─── Claude call ─────────────────────────────────────────────────────────────

/**
 * Stream one section from Claude and return the full text.
 */
async function generateSection(client, section, data) {
  const sectionData = section.dataFn(data);
  const dataStr     = JSON.stringify(sectionData, null, 2);
  const userPrompt  = section.prompt(data, dataStr);

  process.stdout.write(`  ▸ ${section.heading}… `);

  const stream = await client.messages.stream({
    model:      MODEL,
    max_tokens: 1024,
    system:     GROUNDING,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  let text = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      text += event.delta.text;
      process.stdout.write('.');
    }
  }
  process.stdout.write(' done\n');
  return text.trim();
}

// ─── quickFacts derivation ───────────────────────────────────────────────────

/**
 * Generate a one-sentence visa summary using Claude (tiny call, fast).
 */
async function generateVisaSummary(client, data) {
  const { name, visa } = data;
  const hasVisa = visa && !visa._unavailable &&
    Object.values(visa).some(v => !v._unavailable);

  if (!hasVisa) {
    return 'Check official government sources for entry requirements.';
  }

  const lines = Object.entries(visa)
    .filter(([, v]) => !v._unavailable)
    .map(([passport, v]) => `${passport}: ${v.requirement}${v.duration ? ` (${v.duration})` : ''}`)
    .join('; ');

  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 80,
    messages:   [{
      role:    'user',
      content: `In one short sentence (max 100 chars), summarise the visa situation for ${name} using this data: ${lines}. Start with the most permissive entry right.`,
    }],
  });
  return msg.content[0]?.text?.trim() ?? 'Check official government sources.';
}

/**
 * Generate bestMonths using Claude (tiny call).
 */
async function generateBestMonths(client, data) {
  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 40,
    messages:   [{
      role:    'user',
      content: `In 3–5 words, name the best months to visit ${data.name} (${data.subregion}). Examples: "April to October", "December to March". Return only the phrase.`,
    }],
  });
  return msg.content[0]?.text?.trim() ?? '';
}

// ─── frontmatter ─────────────────────────────────────────────────────────────

function buildFrontmatter(data, quickFacts) {
  const title       = `${data.name} Travel Guide`;
  const description = `Everything you need to plan a trip to ${data.name}: visa rules, best time to visit, where to go, budget tips, and sample itineraries.`.slice(0, 155);
  const today       = new Date().toISOString().slice(0, 10);

  // Escape any YAML-unsafe chars in strings
  const esc = s => s ? s.replace(/"/g, '\\"') : '';

  const qf = quickFacts;
  return [
    '---',
    `title: "${esc(title)}"`,
    `description: "${esc(description)}"`,
    `country: "${esc(data.name)}"`,
    `slug: "${esc(data.slug)}"`,
    `heroImage: ""`,
    `lastUpdated: "${today}"`,
    `quickFacts:`,
    `  capital: "${esc(data.capital ?? '')}"`,
    `  currency: "${esc(data.currency ?? '')}${data.currencySymbol ? ' (' + esc(data.currencySymbol) + ')' : ''}"`,
    `  language: ""`,
    `  bestMonths: "${esc(qf.bestMonths)}"`,
    `  budgetPerDay: ${data.budget_per_day !== null && data.budget_per_day !== undefined ? data.budget_per_day : 'null'}`,
    `  visaSummary: "${esc(qf.visaSummary)}"`,
    '---',
    '',
  ].join('\n');
}

// ─── assemble MDX ────────────────────────────────────────────────────────────

function assembleMDX(frontmatter, sections) {
  const parts = [frontmatter];
  for (const { heading, text } of sections) {
    parts.push(`## ${heading}\n\n${text}\n`);
  }
  return parts.join('\n');
}

// ─── process one country ─────────────────────────────────────────────────────

async function processCountry(client, dataFile) {
  const data     = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const outFile  = path.join(OUTPUT_DIR, `${data.slug}.mdx`);

  if (!FORCE && fs.existsSync(outFile)) {
    skip(`${data.name} — guide exists (--force to regenerate)`);
    return 'skipped';
  }

  log('\n🌍', `${data.name} (${data.id})`);

  // Quick facts (two tiny calls in parallel)
  info('Generating quick facts…');
  const [visaSummary, bestMonths] = await Promise.all([
    generateVisaSummary(client, data),
    generateBestMonths(client, data),
  ]);
  ok(`Quick facts done`);

  // Generate each section sequentially to respect rate limits
  const sectionResults = [];
  for (const section of SECTIONS) {
    const text = await generateSection(client, section, data);
    sectionResults.push({ heading: section.heading, text });
  }

  // Assemble
  const frontmatter = buildFrontmatter(data, { visaSummary, bestMonths });
  const mdx         = assembleMDX(frontmatter, sectionResults);

  fs.writeFileSync(outFile, mdx, 'utf8');
  ok(`Written → ${path.relative(ROOT, outFile)}`);
  return 'done';
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set in .env.local');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Discover data files
  let dataFiles = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DATA_DIR, f));

  if (ONLY_SLUG) {
    dataFiles = dataFiles.filter(f => path.basename(f, '.json') === ONLY_SLUG);
  } else if (ONLY_IDS) {
    dataFiles = dataFiles.filter(f => {
      try {
        const d = JSON.parse(fs.readFileSync(f, 'utf8'));
        return ONLY_IDS.has(d.id);
      } catch { return false; }
    });
  }

  if (dataFiles.length === 0) {
    warn('No data files found. Run `npm run fetch:guides` first.');
    process.exit(0);
  }

  const summary = { done: [], skipped: [], failed: [] };

  for (const file of dataFiles) {
    try {
      const result = await processCountry(client, file);
      const slug = path.basename(file, '.json');
      if (result === 'skipped') summary.skipped.push(slug);
      else                       summary.done.push(slug);
    } catch (err) {
      const slug = path.basename(file, '.json');
      warn(`Failed for ${slug}: ${err.message}`);
      summary.failed.push(slug);
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Summary');
  console.log('─'.repeat(60));
  console.log(`  Generated : ${summary.done.length}  [${summary.done.join(', ')}]`);
  console.log(`  Skipped   : ${summary.skipped.length}  [${summary.skipped.join(', ')}]`);
  console.log(`  Failed    : ${summary.failed.length}  [${summary.failed.join(', ')}]`);

  if (summary.failed.length) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

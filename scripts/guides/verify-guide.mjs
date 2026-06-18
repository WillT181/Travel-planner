#!/usr/bin/env node
/**
 * verify-guide.mjs
 * ---------------------------------------------------------------------------
 * Audits a generated MDX guide against its grounded source data using a
 * second Claude pass.  Extracts every concrete factual claim and classifies
 * each as SUPPORTED, UNSUPPORTED, or GENERIC-OK.
 *
 * Exit codes:
 *   0  PASS  — no unsupported hard facts found
 *   1  FAIL  — one or more visa rules, prices, or travel times are NOT in data
 *   2  ERROR — missing files, API failure, or parse error
 *
 * Output:
 *   scripts/guides/reports/{slug}.md  — human-readable claim-by-claim report
 *
 * Usage:
 *   node scripts/guides/verify-guide.mjs --slug france
 *   node scripts/guides/verify-guide.mjs --only FR,JP
 *   node scripts/guides/verify-guide.mjs              # verify all existing guides
 * ---------------------------------------------------------------------------
 */

import fs       from 'node:fs';
import path     from 'node:path';
import url      from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../..');

// ─── paths ──────────────────────────────────────────────────────────────────

const DATA_DIR    = path.join(__dirname, 'data');
const GUIDES_DIR  = path.join(ROOT, 'src/content/guides');
const REPORTS_DIR = path.join(__dirname, 'reports');

// ─── model ──────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';

// "Hard fact" claim types — UNSUPPORTED on these causes a FAIL
const HARD_FACT_TYPES = new Set(['visa_rule', 'price', 'travel_time']);

// ─── env / args ─────────────────────────────────────────────────────────────

loadEnv(path.join(ROOT, '.env.local'));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

const args     = process.argv.slice(2);
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
function fail(...msg)        { log('  ✗', ...msg); }
function skip(...msg)        { log('  –', ...msg); }

// ─── data slimming ───────────────────────────────────────────────────────────

/**
 * Reduce the grounded data to what the verifier needs.
 * Strips lat/lng coords, keeps only top 20 cities, strips POI coordinates.
 */
function slimData(data) {
  const slim = {
    id:              data.id,
    name:            data.name,
    slug:            data.slug,
    capital:         data.capital,
    region:          data.region,
    subregion:       data.subregion,
    currency:        data.currency,
    currencySymbol:  data.currencySymbol,
    budget_per_day:  data.budget_per_day,
    visa:            data.visa,
    cities:          null,
    pointsOfInterest: null,
  };

  if (Array.isArray(data.cities)) {
    slim.cities = data.cities.slice(0, 20).map(c => ({
      name:      c.name,
      isCapital: c.isCapital,
    }));
  }

  if (data.pointsOfInterest && !data.pointsOfInterest._unavailable) {
    const stripped = {};
    for (const [city, pois] of Object.entries(data.pointsOfInterest)) {
      stripped[city] = Array.isArray(pois)
        ? pois.map(p => p.name).filter(Boolean)
        : pois;
    }
    slim.pointsOfInterest = stripped;
  } else {
    slim.pointsOfInterest = data.pointsOfInterest;
  }

  return slim;
}

// ─── MDX prose extraction ────────────────────────────────────────────────────

/**
 * Strip the YAML frontmatter block (between the opening and closing `---`)
 * and return only the prose body of the MDX file.
 */
function stripFrontmatter(mdx) {
  const match = mdx.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : mdx.trim();
}

// ─── Claude verification call ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `\
You are a rigorous travel content fact-checker. You receive:
1. A JSON object of grounded source data (the authoritative facts).
2. The prose of a travel guide generated from that data.

Your task: extract EVERY concrete factual claim from the guide prose and classify each.

CLAIM TYPES:
- visa_rule  — specific entry requirements, visa-free periods, required documents
- price      — any specific cost, price range with numbers, or budget figure
- travel_time — journey durations, "X hours from Y", flight times
- named_place — a specific attraction, museum, landmark, or neighbourhood
- date_event  — a specific festival date, event, or seasonal timing claim
- general    — cultural/landscape observations, cuisine overview, vibe descriptions

STATUS:
- SUPPORTED   — the claim is directly verifiable from the grounded data JSON provided
- UNSUPPORTED — a specific concrete fact (visa rule, price, travel time, named place or event)
                that is NOT present in the grounded data — potentially hallucinated
- GENERIC-OK  — a general statement about culture, geography, cuisine, or atmosphere that
                travel writers reasonably make from broad knowledge without a specific data
                source. World-famous landmarks (Eiffel Tower, Colosseum, Mount Fuji, Big Ben,
                Machu Picchu, etc.) are always GENERIC-OK even if not listed in the data.
                Seasonal advice such as "summers are warm" or "avoid monsoon season" is
                GENERIC-OK for the relevant region.

RULES:
- Only mark UNSUPPORTED if you are highly confident the claim is a hard concrete fact
  not present in the source data.
- General statements about a country's character, cuisine style, cultural customs, or
  landscape type are GENERIC-OK even if no corresponding data field exists.
- Visa data with "_unavailable" means NO visa facts were available — any specific visa
  rule stated in the guide is therefore UNSUPPORTED.
- If budget_per_day is null, any specific daily budget figure in the guide is UNSUPPORTED.

Output ONLY a valid JSON object — no preamble, no explanation, no markdown fences:
{
  "claims": [
    {
      "text": "short paraphrase of the claim (max 120 chars)",
      "type": "visa_rule|price|travel_time|named_place|date_event|general",
      "status": "SUPPORTED|UNSUPPORTED|GENERIC-OK",
      "reason": "one sentence explaining the classification"
    }
  ]
}`;

async function verifyClaims(client, guideProse, grounded) {
  const slim    = slimData(grounded);
  const dataStr = JSON.stringify(slim, null, 2);

  const userMsg =
    `## Grounded Source Data\n\n\`\`\`json\n${dataStr}\n\`\`\`\n\n` +
    `## Guide Prose\n\n${guideProse}\n\n` +
    `Extract and classify every concrete factual claim as instructed.`;

  const msg = await client.messages.create({
    model:      MODEL,
    max_tokens: 4096,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userMsg }],
  });

  const raw = msg.content[0]?.text ?? '';
  // Strip accidental markdown fences if the model adds them
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.claims)) throw new Error('claims field missing');
    return parsed.claims;
  } catch (err) {
    throw new Error(`Failed to parse verification JSON: ${err.message}\nRaw:\n${raw.slice(0, 500)}`);
  }
}

// ─── report generation ───────────────────────────────────────────────────────

function buildReport(grounded, claims, passed) {
  const today  = new Date().toISOString().slice(0, 10);
  const { name, slug } = grounded;

  const unsupported = claims.filter(c => c.status === 'UNSUPPORTED');
  const supported   = claims.filter(c => c.status === 'SUPPORTED');
  const genericOk   = claims.filter(c => c.status === 'GENERIC-OK');
  const hardFails   = unsupported.filter(c => HARD_FACT_TYPES.has(c.type));

  const resultLine = passed
    ? `## Result: PASS ✓`
    : `## Result: FAIL ✗`;

  const lines = [
    `# Verification Report: ${name}`,
    `**Generated:** ${today}  `,
    `**Guide:** src/content/guides/${slug}.mdx  `,
    `**Data:** scripts/guides/data/${slug}.json`,
    '',
    '---',
    '',
    resultLine,
    '',
    `**${claims.length} claims reviewed** — ` +
      `${supported.length} supported, ` +
      `${unsupported.length} unsupported, ` +
      `${genericOk.length} generic-ok`,
    '',
  ];

  if (!passed) {
    lines.push(
      `> ✗ **${hardFails.length} hard unsupported claim(s)** found ` +
      `(visa rules, prices, or travel times not in the source data).`,
      '',
    );
  }

  lines.push('---', '');

  // ── Unsupported claims ──
  lines.push(`## ⚠ Unsupported Claims (${unsupported.length})`);
  if (unsupported.length === 0) {
    lines.push('', '*None — all concrete claims are grounded.*', '');
  } else {
    lines.push('', '| # | Claim | Type | Reason |');
    lines.push('|---|-------|------|--------|');
    unsupported.forEach((c, i) => {
      const hard = HARD_FACT_TYPES.has(c.type) ? ' 🔴' : ' 🟡';
      lines.push(`| ${i + 1} | ${c.text}${hard} | \`${c.type}\` | ${c.reason} |`);
    });
    lines.push('');
    lines.push('> 🔴 = hard fact (causes FAIL) &nbsp; 🟡 = worth reviewing, not a hard FAIL');
    lines.push('');
  }

  // ── Generic-OK claims ──
  lines.push(`## ○ Generic-OK Claims (${genericOk.length})`);
  if (genericOk.length === 0) {
    lines.push('', '*None.*', '');
  } else {
    lines.push('');
    genericOk.forEach(c => lines.push(`- ${c.text} *(${c.type})*`));
    lines.push('');
  }

  // ── Supported claims ──
  lines.push(`## ✓ Supported Claims (${supported.length})`);
  if (supported.length === 0) {
    lines.push('', '*None.*', '');
  } else {
    lines.push('');
    supported.forEach(c => lines.push(`- ${c.text} *(${c.type})*`));
    lines.push('');
  }

  return lines.join('\n');
}

// ─── process one guide ───────────────────────────────────────────────────────

async function processGuide(client, slug) {
  const guideFile = path.join(GUIDES_DIR, `${slug}.mdx`);
  const dataFile  = path.join(DATA_DIR,   `${slug}.json`);

  if (!fs.existsSync(guideFile)) {
    skip(`${slug} — guide not found (run generate:guides first)`);
    return { slug, result: 'missing' };
  }
  if (!fs.existsSync(dataFile)) {
    skip(`${slug} — data file not found (run fetch:guides first)`);
    return { slug, result: 'missing' };
  }

  const mdx      = fs.readFileSync(guideFile, 'utf8');
  const grounded = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const prose    = stripFrontmatter(mdx);

  log('\n🔍', `Verifying ${grounded.name} (${slug})`);
  info('Sending to Claude for claim extraction…');

  const claims = await verifyClaims(client, prose, grounded);

  const unsupported = claims.filter(c => c.status === 'UNSUPPORTED');
  const hardFails   = unsupported.filter(c => HARD_FACT_TYPES.has(c.type));
  const passed      = hardFails.length === 0;

  // Write report
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const reportFile = path.join(REPORTS_DIR, `${slug}.md`);
  const report     = buildReport(grounded, claims, passed);
  fs.writeFileSync(reportFile, report, 'utf8');

  if (passed) {
    ok(`PASS — ${claims.length} claims reviewed, ` +
       `${unsupported.length} flagged as unsupported (none are hard facts)`);
    ok(`Report → ${path.relative(ROOT, reportFile)}`);
  } else {
    fail(`FAIL — ${hardFails.length} hard unsupported claim(s) found`);
    hardFails.forEach(c => fail(`  [${c.type.toUpperCase()}] ${c.text}`));
    warn(`Report → ${path.relative(ROOT, reportFile)}`);
  }

  return { slug, name: grounded.name, result: passed ? 'pass' : 'fail', claims, hardFails };
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set in .env.local');
    process.exit(2);
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Discover guides to verify
  let slugs = [];

  if (ONLY_SLUG) {
    slugs = [ONLY_SLUG];
  } else if (ONLY_IDS) {
    // Map IDs → slugs via data files
    slugs = fs.readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
          return ONLY_IDS.has(d.id) ? d.slug : null;
        } catch { return null; }
      })
      .filter(Boolean);
  } else {
    // All guide files that exist
    if (fs.existsSync(GUIDES_DIR)) {
      slugs = fs.readdirSync(GUIDES_DIR)
        .filter(f => f.endsWith('.mdx'))
        .map(f => path.basename(f, '.mdx'));
    }
  }

  if (slugs.length === 0) {
    warn('No guides found to verify.');
    process.exit(0);
  }

  const summary = { pass: [], fail: [], missing: [], error: [] };

  for (const slug of slugs) {
    try {
      const { result } = await processGuide(client, slug);
      (summary[result] ?? summary.error).push(slug);
    } catch (err) {
      warn(`Error verifying ${slug}: ${err.message}`);
      summary.error.push(slug);
    }
  }

  // ── summary ──
  console.log('\n' + '─'.repeat(60));
  console.log('Verification Summary');
  console.log('─'.repeat(60));
  console.log(`  Pass    : ${summary.pass.length}  [${summary.pass.join(', ')}]`);
  console.log(`  Fail    : ${summary.fail.length}  [${summary.fail.join(', ')}]`);
  console.log(`  Missing : ${summary.missing.length}  [${summary.missing.join(', ')}]`);
  console.log(`  Error   : ${summary.error.length}  [${summary.error.join(', ')}]`);

  if (summary.fail.length > 0) process.exit(1);
  if (summary.error.length > 0) process.exit(2);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});

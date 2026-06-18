#!/usr/bin/env node
/**
 * build-all.mjs
 * ---------------------------------------------------------------------------
 * Full pipeline orchestrator for all 50 travel guide countries.
 *
 * For each country:
 *   1. fetch-country-data  — build grounded data file (skips if exists)
 *   2. generate-guide      — generate MDX guide (skips if exists)
 *   3. verify-guide        — audit claims against grounded data (always runs)
 *
 * Up to CONCURRENCY countries run simultaneously (default: 3).
 *
 * Usage:
 *   node scripts/guides/build-all.mjs
 *   node scripts/guides/build-all.mjs --concurrency 5
 *   node scripts/guides/build-all.mjs --only FR,JP,IT
 *   node scripts/guides/build-all.mjs --from vietnam      # resume from slug
 *   node scripts/guides/build-all.mjs --force             # re-run all steps
 *
 * Exit codes:
 *   0  all guides passed verification
 *   1  one or more guides flagged as FAIL
 *   2  pipeline error (missing API key, etc.)
 * ---------------------------------------------------------------------------
 */

import fs          from 'node:fs';
import path        from 'node:path';
import url         from 'node:url';
import { spawn }   from 'node:child_process';
import readline    from 'node:readline';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '../..');

// ─── paths ──────────────────────────────────────────────────────────────────

const TOP50_FILE = path.join(__dirname, 'top50.json');
const SCRIPTS    = {
  fetch:    path.join(__dirname, 'fetch-country-data.mjs'),
  generate: path.join(__dirname, 'generate-guide.mjs'),
  verify:   path.join(__dirname, 'verify-guide.mjs'),
};

// ─── env / args ─────────────────────────────────────────────────────────────

loadEnv(path.join(ROOT, '.env.local'));

const args        = process.argv.slice(2);
const FORCE       = args.includes('--force');
const onlyRaw     = args.find((_, i) => args[i - 1] === '--only');
const fromRaw     = args.find((_, i) => args[i - 1] === '--from');
const concRaw     = args.find((_, i) => args[i - 1] === '--concurrency');
const ONLY_IDS    = onlyRaw ? new Set(onlyRaw.split(',').map(s => s.trim().toUpperCase())) : null;
const FROM_SLUG   = fromRaw ? fromRaw.trim().toLowerCase() : null;
const CONCURRENCY = concRaw ? Math.max(1, parseInt(concRaw, 10) || 3) : 3;

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

function padEnd(str, len) {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

// ─── child process runner ────────────────────────────────────────────────────

/**
 * Spawn a Node script with line-prefixed live output.
 * Returns the exit code.
 */
function runScript(label, scriptPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env:   process.env,
    });

    const prefix = `[${label}]`.padEnd(22);

    for (const [stream, dest] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      rl.on('line', line => dest.write(`${prefix} ${line}\n`));
    }

    child.on('close', code => resolve(code ?? 0));
    child.on('error', reject);
  });
}

// ─── concurrency pool ────────────────────────────────────────────────────────

/**
 * Run an array of async task factories with at most `limit` running at once.
 * Returns results in the same order as the input tasks array.
 */
async function pool(taskFns, limit) {
  const results   = new Array(taskFns.length);
  const queue     = taskFns.map((fn, i) => ({ fn, i }));
  const inFlight  = new Set();

  async function runNext() {
    if (queue.length === 0) return;
    const { fn, i } = queue.shift();
    const p = fn().then(r => {
      results[i] = r;
      inFlight.delete(p);
      return runNext();
    });
    inFlight.add(p);
    return p;
  }

  // Seed initial workers
  const seeds = [];
  for (let i = 0; i < Math.min(limit, taskFns.length); i++) {
    seeds.push(runNext());
  }
  await Promise.all(seeds);
  await Promise.all([...inFlight]);

  return results;
}

// ─── per-country pipeline ────────────────────────────────────────────────────

/**
 * Status object shape:
 *   { id, slug, name, fetch, generate, verify }
 *   Each phase: 'ok' | 'skipped' | 'failed' | 'pending' | 'errored'
 * verify gets an extra `verifyResult`: 'pass' | 'flagged' | 'error'
 */
async function runCountry(entry) {
  const { id, slug, name } = entry;
  const label = `${name} (${id})`;

  const status = {
    id, slug, name,
    fetch:    'pending',
    generate: 'pending',
    verify:   'pending',
    verifyResult: 'pending',
  };

  // ── Step 1: Fetch ──
  const fetchArgs = ['--only', id, ...(FORCE ? ['--force'] : [])];
  try {
    console.log(`\n${'═'.repeat(68)}`);
    console.log(`  FETCH  ${label}`);
    console.log(`${'═'.repeat(68)}`);
    const code = await runScript(name, SCRIPTS.fetch, fetchArgs);
    status.fetch = code === 0 ? 'ok' : 'failed';
    if (code !== 0) {
      console.error(`  ⚠ fetch failed (exit ${code}) — skipping generate + verify`);
      status.generate = 'skipped';
      status.verify   = 'skipped';
      status.verifyResult = 'skipped';
      return status;
    }
  } catch (err) {
    console.error(`  ✗ fetch errored: ${err.message}`);
    status.fetch    = 'errored';
    status.generate = 'skipped';
    status.verify   = 'skipped';
    status.verifyResult = 'skipped';
    return status;
  }

  // ── Step 2: Generate ──
  const genArgs = ['--slug', slug, ...(FORCE ? ['--force'] : [])];
  try {
    console.log(`\n${'─'.repeat(68)}`);
    console.log(`  GENERATE  ${label}`);
    console.log(`${'─'.repeat(68)}`);
    const code = await runScript(name, SCRIPTS.generate, genArgs);
    status.generate = code === 0 ? 'ok' : 'failed';
    if (code !== 0) {
      console.error(`  ⚠ generate failed (exit ${code}) — skipping verify`);
      status.verify = 'skipped';
      status.verifyResult = 'skipped';
      return status;
    }
  } catch (err) {
    console.error(`  ✗ generate errored: ${err.message}`);
    status.generate = 'errored';
    status.verify   = 'skipped';
    status.verifyResult = 'skipped';
    return status;
  }

  // ── Step 3: Verify (always runs) ──
  const verifyArgs = ['--slug', slug];
  try {
    console.log(`\n${'·'.repeat(68)}`);
    console.log(`  VERIFY  ${label}`);
    console.log(`${'·'.repeat(68)}`);
    const code = await runScript(name, SCRIPTS.verify, verifyArgs);
    status.verify = 'ok';
    if (code === 0) {
      status.verifyResult = 'pass';
    } else if (code === 1) {
      status.verifyResult = 'flagged';
    } else {
      status.verifyResult = 'error';
    }
  } catch (err) {
    console.error(`  ✗ verify errored: ${err.message}`);
    status.verify       = 'errored';
    status.verifyResult = 'error';
  }

  return status;
}

// ─── summary table ───────────────────────────────────────────────────────────

function printSummary(results, total) {
  const W = { name: 22, fetch: 9, generate: 10, verify: 8, status: 12 };
  const divider = '─'.repeat(Object.values(W).reduce((a, b) => a + b, 0) + 10);

  console.log('\n' + '═'.repeat(divider.length));
  console.log('  BUILD-ALL SUMMARY');
  console.log('═'.repeat(divider.length));

  const header =
    padEnd('Country', W.name) + '  ' +
    padEnd('Fetch', W.fetch) + '  ' +
    padEnd('Generate', W.generate) + '  ' +
    padEnd('Verify', W.verify) + '  ' +
    'Status';
  console.log(header);
  console.log(divider);

  const icons = {
    ok:      '✓ ok',
    skipped: '– skip',
    failed:  '✗ fail',
    errored: '✗ err',
    pending: '?',
  };
  const verifyIcons = {
    pass:    '✓ PASS',
    flagged: '✗ FLAGGED',
    error:   '✗ ERROR',
    skipped: '– skip',
    pending: '?',
  };

  for (const r of results) {
    if (!r) continue;
    const statusIcon = r.verifyResult === 'pass'    ? '✓ ok'
                     : r.verifyResult === 'flagged' ? '✗ FLAGGED'
                     : r.verifyResult === 'skipped' ? '– skipped'
                     :                                '✗ error';

    const row =
      padEnd(r.name, W.name) + '  ' +
      padEnd(icons[r.fetch]    ?? r.fetch,    W.fetch)    + '  ' +
      padEnd(icons[r.generate] ?? r.generate, W.generate) + '  ' +
      padEnd(verifyIcons[r.verifyResult] ?? r.verifyResult, W.verify + 2) + '  ' +
      statusIcon;
    console.log(row);
  }

  console.log(divider);

  const passed  = results.filter(r => r?.verifyResult === 'pass');
  const flagged = results.filter(r => r?.verifyResult === 'flagged');
  const errors  = results.filter(r => r?.verifyResult === 'error' || r?.fetch === 'failed' || r?.generate === 'failed');

  console.log('');
  const flagNames = flagged.map(r => r.name).join(', ');
  const errNames  = errors .map(r => r.name).join(', ');

  console.log(`${passed.length}/${total} guides passed` +
    (flagged.length ? `, ${flagged.length} flagged for review` : '') +
    (errors.length  ? `, ${errors.length} errored` : '') +
    '.'
  );
  if (flagged.length) console.log(`Flagged: ${flagNames}`);
  if (errors.length)  console.log(`Errors:  ${errNames}`);
  console.log('');

  if (flagged.length) {
    console.log('Review flagged guides:');
    flagged.forEach(r =>
      console.log(`  scripts/guides/reports/${r.slug}.md`)
    );
    console.log('');
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';
  if (!ANTHROPIC_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set in .env.local');
    process.exit(2);
  }

  const top50 = JSON.parse(fs.readFileSync(TOP50_FILE, 'utf8'));

  // Apply filters
  let entries = top50;

  if (ONLY_IDS) {
    entries = entries.filter(e => ONLY_IDS.has(e.id));
  }
  if (FROM_SLUG) {
    const idx = entries.findIndex(e => e.slug === FROM_SLUG);
    if (idx === -1) {
      console.error(`Error: --from slug "${FROM_SLUG}" not found in top50.json`);
      process.exit(2);
    }
    entries = entries.slice(idx);
  }

  if (entries.length === 0) {
    console.warn('No countries selected.');
    process.exit(0);
  }

  console.log(`\nBuild-all: ${entries.length} countries, concurrency ${CONCURRENCY}${FORCE ? ', --force' : ''}`);
  console.log(`Countries: ${entries.map(e => e.id).join(', ')}\n`);

  const taskFns = entries.map(entry => () => runCountry(entry));
  const results = await pool(taskFns, CONCURRENCY);

  printSummary(results, entries.length);

  const anyFlagged = results.some(r => r?.verifyResult === 'flagged');
  const anyError   = results.some(r =>
    r?.verifyResult === 'error' ||
    r?.fetch    === 'failed' || r?.fetch    === 'errored' ||
    r?.generate === 'failed' || r?.generate === 'errored'
  );

  if (anyError)   process.exit(2);
  if (anyFlagged) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(2);
});

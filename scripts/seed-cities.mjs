#!/usr/bin/env node
/**
 * seed-cities.mjs
 * ---------------------------------------------------------------------------
 * One-off seeder: loads src/data/destinations/cities.full.json (~156k cities)
 * into the public.cities table (see supabase/migrations/0008_cities.sql), using
 * the Supabase service-role key so it bypasses RLS.
 *
 * Rows are inserted in batches of 1000.
 *
 * Requires (read from the environment or .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY     # service_role secret — NEVER expose client-side
 *
 * Usage:
 *   npm run seed:cities            # skips if the table already has rows
 *   npm run seed:cities -- --reset # delete existing rows first, then re-seed
 * ---------------------------------------------------------------------------
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

const CHUNK = 1000;
const DATA_FILE = path.resolve("src/data/destinations/cities.full.json");
const RESET = process.argv.slice(2).includes("--reset");

const log = (...m) => console.log("▸", ...m);

/** Minimal .env.local loader so the script works without dotenv installed. */
function loadEnvLocal() {
  const file = path.resolve(".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      "✖ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set " +
        "(in the environment or .env.local)."
    );
    process.exit(1);
  }

  if (!fs.existsSync(DATA_FILE)) {
    console.error(
      `✖ ${DATA_FILE} not found — run "npm run generate:destinations" first.`
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Guard against accidental duplicate seeding.
  const { count, error: countError } = await supabase
    .from("cities")
    .select("*", { count: "exact", head: true });
  if (countError) {
    console.error("✖ Could not query the cities table:", countError.message);
    console.error("  Did you run migration 0008_cities.sql?");
    process.exit(1);
  }

  if ((count ?? 0) > 0) {
    if (!RESET) {
      log(
        `cities already has ${count} rows — nothing to do. ` +
          "Pass --reset to wipe and re-seed."
      );
      return;
    }
    log(`Deleting ${count} existing rows…`);
    const { error: delError } = await supabase
      .from("cities")
      .delete()
      .gt("id", 0);
    if (delError) {
      console.error("✖ Failed to clear the table:", delError.message);
      process.exit(1);
    }
  }

  const cities = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  log(`Seeding ${cities.length} cities in batches of ${CHUNK}…`);

  let inserted = 0;
  for (let i = 0; i < cities.length; i += CHUNK) {
    const batch = cities.slice(i, i + CHUNK).map((c) => ({
      name: c.name,
      country_id: c.countryId,
    }));
    const { error } = await supabase.from("cities").insert(batch);
    if (error) {
      console.error(
        `✖ Insert failed at rows ${i}–${i + batch.length}:`,
        error.message
      );
      process.exit(1);
    }
    inserted += batch.length;
    if (inserted % (CHUNK * 10) === 0 || inserted === cities.length) {
      log(`  …${inserted}/${cities.length}`);
    }
  }

  log(`✓ Done — ${inserted} cities seeded.`);
}

main().catch((err) => {
  console.error("✖ Unexpected error:", err);
  process.exit(1);
});

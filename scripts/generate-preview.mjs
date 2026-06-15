/**
 * Generates a self-contained visual preview of the app at the current commit.
 *
 * It builds + boots the production server, screenshots every key page in
 * desktop and mobile viewports, and writes a single `preview/index.html` with
 * all images embedded inline (no external files needed to open it).
 *
 * Usage:
 *   npm run preview          # build, capture, write preview/index.html
 *
 * One-time setup (local machines): `npx playwright install chromium`.
 * Re-run any time after changing code to refresh the snapshot.
 */
import { spawn, execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const PORT = process.env.PREVIEW_PORT || "3210";
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = "preview";

/** Pages worth showing. Auth-gated routes redirect to /login when logged out. */
const PAGES = [
  { path: "/", name: "Home" },
  { path: "/explore", name: "Explore" },
  { path: "/explore/lisbon", name: "Destination detail" },
  { path: "/search", name: "Search" },
  { path: "/signup", name: "Sign up" },
  { path: "/login", name: "Log in" },
];

const VIEWS = [
  { kind: "desktop", width: 1280, height: 900, isMobile: false },
  { kind: "mobile", width: 390, height: 844, isMobile: true },
];

async function waitForServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  throw new Error("Server did not become ready in time.");
}

function gitInfo() {
  const safe = (cmd, fallback) => {
    try {
      return execSync(cmd).toString().trim();
    } catch {
      return fallback;
    }
  };
  return {
    commit: safe("git rev-parse --short HEAD", "unknown"),
    branch: safe("git rev-parse --abbrev-ref HEAD", "unknown"),
    subject: safe("git log -1 --pretty=%s", ""),
  };
}

function renderHtml(shots, info, generatedAt) {
  const byPage = PAGES.map((p) => {
    const desktop = shots.find((s) => s.path === p.path && s.kind === "desktop");
    const mobile = shots.find((s) => s.path === p.path && s.kind === "mobile");
    return { ...p, desktop, mobile };
  });

  const tabs = byPage
    .map(
      (p, i) =>
        `<button class="tab${i === 0 ? " active" : ""}" data-target="page-${i}">${p.name}</button>`
    )
    .join("");

  const panels = byPage
    .map(
      (p, i) => `
      <section class="panel${i === 0 ? " active" : ""}" id="page-${i}">
        <div class="panel-head">
          <h2>${p.name}</h2>
          <code>${p.path}</code>
        </div>
        <div class="shots">
          <figure class="desktop">
            <figcaption>Desktop · 1280px</figcaption>
            <img loading="lazy" src="data:image/png;base64,${p.desktop ? p.desktop.b64 : ""}" alt="${p.name} desktop" />
          </figure>
          <figure class="mobile">
            <figcaption>Mobile · 390px</figcaption>
            <img loading="lazy" src="data:image/png;base64,${p.mobile ? p.mobile.b64 : ""}" alt="${p.name} mobile" />
          </figure>
        </div>
      </section>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wanderly — Preview (${info.commit})</title>
<style>
  :root { --teal:#0d9488; --teal-dark:#0f766e; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Inter, system-ui, -apple-system, sans-serif; color: var(--ink); background: var(--bg); }
  header { position: sticky; top:0; z-index:10; background:#fff; border-bottom:1px solid var(--line); padding:16px 20px; }
  .title { display:flex; align-items:center; gap:10px; font-weight:800; font-size:18px; color:var(--teal-dark); }
  .dot { width:10px; height:10px; border-radius:999px; background:#f59e0b; }
  .meta { margin-top:4px; font-size:12px; color:var(--muted); }
  .tabs { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
  .tab { cursor:pointer; border:1px solid var(--line); background:#fff; color:#334155; padding:8px 14px; border-radius:999px; font-size:14px; font-weight:500; }
  .tab:hover { background:#f1f5f9; }
  .tab.active { background:var(--teal); border-color:var(--teal); color:#fff; }
  main { padding:24px 20px 60px; max-width:1400px; margin:0 auto; }
  .panel { display:none; }
  .panel.active { display:block; }
  .panel-head { display:flex; align-items:baseline; gap:10px; margin-bottom:14px; }
  .panel-head h2 { margin:0; font-size:22px; }
  .panel-head code { color:var(--muted); font-size:13px; }
  .shots { display:grid; grid-template-columns: minmax(0,1fr) 320px; gap:24px; align-items:start; }
  @media (max-width: 860px){ .shots { grid-template-columns: 1fr; } }
  figure { margin:0; }
  figcaption { font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:8px; }
  img { width:100%; height:auto; display:block; border:1px solid var(--line); border-radius:14px; background:#fff; box-shadow:0 1px 3px rgba(15,23,42,.08); }
  .note { margin-top:8px; padding:12px 16px; background:#fffbeb; border:1px solid #fde68a; border-radius:10px; color:#92400e; font-size:13px; }
</style>
</head>
<body>
<header>
  <div class="title"><span class="dot"></span> Wanderly — Visual Preview</div>
  <div class="meta">Branch <strong>${info.branch}</strong> · commit <strong>${info.commit}</strong>${info.subject ? ` · ${info.subject}` : ""} · generated ${generatedAt}</div>
  <div class="note">Static snapshot of the running app. Images load real photos online; if blank, this machine had no network to picsum.photos at capture time. Re-run <code>npm run preview</code> to refresh after code changes.</div>
  <nav class="tabs">${tabs}</nav>
</header>
<main>${panels}</main>
<script>
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    panels.forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.target).classList.add('active');
  }));
</script>
</body>
</html>`;
}

async function main() {
  console.log("Building production bundle…");
  execSync("npm run build", { stdio: "inherit" });

  console.log(`Starting server on :${PORT}…`);
  const server = spawn("npx", ["next", "start", "-p", PORT], {
    stdio: "ignore",
    detached: true,
  });

  try {
    await waitForServer();
    console.log("Capturing screenshots…");
    const browser = await chromium.launch();
    const shots = [];
    for (const view of VIEWS) {
      const ctx = await browser.newContext({
        viewport: { width: view.width, height: view.height },
        isMobile: view.isMobile,
      });
      for (const p of PAGES) {
        const page = await ctx.newPage();
        try {
          await page.goto(BASE + p.path, {
            waitUntil: "networkidle",
            timeout: 30000,
          });
        } catch {
          // capture whatever rendered
        }
        await page.waitForTimeout(1000);
        const buf = await page.screenshot({ fullPage: true });
        shots.push({ ...p, kind: view.kind, b64: buf.toString("base64") });
        await page.close();
        console.log(`  · ${view.kind} ${p.path}`);
      }
      await ctx.close();
    }
    await browser.close();

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const html = renderHtml(shots, gitInfo(), new Date().toUTCString());
    fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
    console.log(`\nWrote ${OUT_DIR}/index.html — open it in any browser.`);
  } finally {
    try {
      process.kill(-server.pid);
    } catch {
      // already gone
    }
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);

// Screenshots of key parts of the site for PROPOSAL.md (site served from dist/ on :4321).
import {chromium} from "playwright-core";
const base = "http://localhost:4321";
const shots = [
  ["duckdb-kpis", "duckdb", /^SuperDB vs DuckDB/, /^Step 1/],
  ["duckdb-ingest", "duckdb", /^Step 1/, /^Step 2/],
  ["duckdb-queries", "duckdb", /^Step 2/, /^The queries, side by side/],
  ["duckdb-browser-json", "duckdb", /^The same raw JSON file/, /^A race on flat data/, /both engines/i],
  ["duckdb-race", "duckdb", /^A race on flat data/, /^What it shows/, /race/i],
  ["gha-shapes", "gha", /^Why it is hard/, /^The same sample/],
  ["quebec-map", "quebec", /^A map, two ways/, /^Population by region/],
  ["query-editor", "query", /^Editor/, /^Parameterized/],

];
const only = process.argv.slice(2);
const browser = await chromium.launch({channel: "chrome"});
const page = await browser.newPage({viewport: {width: 1280, height: 900}, deviceScaleFactor: 2, colorScheme: "light"});
for (const [name, path, from, to, button] of shots) {
  if (only.length && !only.includes(name)) continue;
  await page.goto(`${base}/${path}.html`, {waitUntil: "networkidle"});
  await page.waitForTimeout(1500);
  if (button) {
    await page.getByRole("button", {name: button}).click();
    await page.waitForTimeout(15000);
  }
  const heading = (re) => page.locator("#observablehq-main :is(h1,h2,h3)").filter({hasText: re}).first();
  const main = await page.locator("#observablehq-main").boundingBox();
  const a = await heading(from).boundingBox(), b = await heading(to).boundingBox();
  const sy = await page.evaluate(() => window.scrollY); // boundingBox is relative to the viewport
  const clip = {x: main.x - 8, y: a.y + sy - 6, width: main.width + 16, height: Math.min(b.y - a.y - 4, 1500)};
  await page.screenshot({path: `docs/img/${name}.png`, clip, fullPage: true});
  console.log(name, Math.round(clip.width), "x", Math.round(clip.height));
}
await browser.close();

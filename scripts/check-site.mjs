// Checks every page in both languages (served from dist on :4321): no errors, language switch, explorers.
// Usage: node scripts/check-site.mjs   (python3 -m http.server 4321 -d dist)
import {chromium} from "playwright-core";
const base = "http://localhost:4321";
const slugs = ["index", "gha", "bluesky", "clickbench", "quebec", "duckdb", "comparison", "query", "bench"];
const browser = await chromium.launch({channel: "chrome"});
const page = await browser.newPage({viewport: {width: 1250, height: 1000}});
let errs = [];
page.on("pageerror", (e) => errs.push(e.message));
let failed = 0;
const text = () => page.evaluate(() => document.body.innerText);

for (const lang of ["en", "fr"]) {
  for (const slug of slugs) {
    errs = [];
    await page.goto(`${base}/${lang === "fr" ? "fr/" : ""}${slug}.html`, {waitUntil: "networkidle"});
    await page.waitForTimeout(slug === "query" ? 4000 : 1500);
    const switchLink = page.locator(".lang-switch a");
    const href = await switchLink.getAttribute("href");
    const obsErrors = await page.locator(".observablehq--error").allInnerTexts();
    const ok = !errs.length && !obsErrors.length;
    if (!ok) failed++;
    console.log(`${ok ? "ok  " : "FAIL"} ${lang}/${slug} → switch ${await switchLink.innerText()} (${href})`, ok ? "" : JSON.stringify([...errs, ...obsErrors]).slice(0, 400));
  }
}

for (const [lang, placeholder, re] of [["", "e.g. bluesky", /[\d,]+ posts,[^\n]*/], ["fr/", "ex. bluesky", /[\d  ]+ posts,[^\n]*/]]) {
  await page.goto(`${base}/${lang}bluesky.html`, {waitUntil: "networkidle"});
  await page.waitForFunction(() => /\d posts,/.test(document.body.innerText), null, {timeout: 60000});
  await page.fill(`input[placeholder^='${placeholder}']`, "café");
  await page.selectOption("select >> nth=1", {label: "fr"});
  await page.waitForTimeout(1500);
  const t = await text();
  console.log(`${lang || "en/"}bluesky explorer:`, t.match(re)?.[0], "|", t.match(/from posts \|[^\n]*/)?.[0]);
}

for (const [lang, placeholder, word] of [["", "e.g. bump", "events,"], ["fr/", "ex. bump", "événements,"]]) {
  await page.goto(`${base}/${lang}gha.html`, {waitUntil: "networkidle"});
  await page.waitForTimeout(1500);
  const input = page.getByPlaceholder(new RegExp("^" + placeholder));
  await input.fill("security"); await input.press("Enter");
  await page.waitForTimeout(1500);
  await page.locator("select").nth(1).selectOption({label: "Go"});
  await page.waitForTimeout(1500);
  console.log(`${lang || "en/"}gha explorer:`, (await page.locator("p", {hasText: word}).innerText()).replace(/\s+/g, " "));
}

for (const [lang, placeholder, re] of [["", "e.g. фильм", /[\d,]+ searches out of[^\n]*/], ["fr/", "ex. фильм", /[\d  ]+ recherches sur[^\n]*/]]) {
  await page.goto(`${base}/${lang}clickbench.html`, {waitUntil: "networkidle"});
  await page.waitForTimeout(2000);
  await page.fill(`input[placeholder^='${placeholder}']`, "фильм");
  await page.waitForTimeout(1500);
  const t = await text();
  console.log(`${lang || "en/"}clickbench explorer:`, t.match(re)?.[0]);
}

for (const [lang, zoom, show, placeholder, rowsWord] of [["", "Greater Montréal", "Population", "Search a municipality", "rows"], ["fr/", "Grand Montréal", "Population", "Chercher une municipalité", "lignes"]]) {
  errs = [];
  await page.goto(`${base}/${lang}quebec.html`, {waitUntil: "networkidle"});
  await page.waitForSelector("pre.error, p.muted:has-text('" + rowsWord + " —')", {timeout: 60000}).catch(() => {});
  await page.getByLabel(zoom).check();
  await page.getByLabel(show, {exact: true}).check();
  await page.getByPlaceholder(new RegExp("^" + placeholder)).fill("Gatineau");
  const examples = await page.locator("select").last().locator("option").allInnerTexts();
  const results = [];
  for (const ex of examples) {
    await page.locator("select").last().selectOption({label: ex});
    await page.waitForTimeout(800);
    const e = await page.locator("pre.error").count();
    results.push(e ? `${ex}: ERROR` : `${ex}: ${(await page.locator("p.muted", {hasText: rowsWord + " —"}).innerText()).trim()}`);
  }
  const circles = await page.locator("svg circle").count();
  const obsErrors = await page.locator(".observablehq--error").allInnerTexts();
  if (errs.length || obsErrors.length || results.some((r) => r.includes("ERROR"))) failed++;
  console.log(`${lang || "en/"}quebec: ${circles} circles |`, results.join(" | "), errs.length || obsErrors.length ? JSON.stringify([...errs, ...obsErrors]).slice(0, 300) : "");
}

for (const [lang, err] of [["", "pre.error"], ["fr/", "pre.erreur"]]) {
  await page.goto(`${base}/${lang}query.html`);
  await page.waitForSelector("textarea", {timeout: 120000});
  await page.waitForTimeout(3000);
  const select = page.locator("form select").first();
  for (const opt of await select.locator("option").allInnerTexts()) {
    await select.selectOption({label: opt});
    await page.waitForTimeout(800);
    const e = await page.locator(err).allInnerTexts();
    if (e.length) failed++;
    console.log(`${lang || "en/"}query ${opt}: ${e.length ? "ERROR " + e[0].slice(0, 200) : "ok"}`);
  }
}

console.log(failed ? `${failed} failures` : "all good");
await browser.close();
process.exit(failed ? 1 : 0);

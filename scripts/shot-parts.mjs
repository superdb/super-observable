// Capture une page en tranches : node scripts/shot-parts.mjs URL préfixe [hauteur]
import {chromium} from "playwright-core";
const [url, prefix, h = "1100"] = process.argv.slice(2);
const browser = await chromium.launch({channel: "chrome"});
const page = await browser.newPage({viewport: {width: 1250, height: 900}});
await page.goto(url, {waitUntil: "networkidle"});
await page.waitForTimeout(+(process.env.ATTENTE ?? 2000));
const total = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0, i = 0; y < total; y += +h, i++) {
  await page.screenshot({path: `${prefix}-${i}.png`, fullPage: true, clip: {x: 0, y, width: 1250, height: Math.min(+h, total - y)}});
  console.log(`${prefix}-${i}.png`);
}
await browser.close();

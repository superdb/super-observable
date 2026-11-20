import { chromium } from "playwright-core"
const [url, out] = process.argv.slice(2)
const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage({ viewport: { width: 1250, height: 900 } })
const errors = []
page.on("pageerror", (e) => errors.push(e.message))
await page.goto(url, { waitUntil: "networkidle" })
await page.waitForTimeout(2000)
console.log("erreurs:", await page.locator(".observablehq--error").allInnerTexts(), errors)
await page.screenshot({ path: out, fullPage: true })
await browser.close()

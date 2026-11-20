import { chromium } from "playwright-core"
const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage()
page.on("console", (m) => console.log("[page]", m.type(), m.text().slice(0, 400)))
page.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 400)))
page.on("worker", (w) => { console.log("[worker créé]"); w.on("console", (m) => console.log("[worker]", m.type(), m.text().slice(0, 600))) })
await page.goto("http://localhost:4321/requete.html")
await page.waitForTimeout(6000)
await browser.close()

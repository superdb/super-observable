// Génère deux jeux d'exemple déterministes en NDJSON dans raw/ :
//   sales.json  — 500 000 lignes tabulaires (le cas favorable à Arrow/Parquet)
//   events.json — 100 000 événements hétérogènes et imbriqués (le cas de SuperDB)
import { mkdirSync, createWriteStream } from "node:fs"

let seed = 42
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
const pick = (a) => a[Math.floor(rand() * a.length)]
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1))

const regions = ["Québec", "Montréal", "Laval", "Gatineau", "Sherbrooke", "Saguenay", "Trois-Rivières"]
const products = Array.from({ length: 200 }, (_, i) => ({ sku: `SKU-${String(i).padStart(4, "0")}`, price: Math.round((5 + rand() * 995) * 100) / 100 }))
const customers = Array.from({ length: 5000 }, (_, i) => `Customer ${i}`)
const t0 = Date.parse("2024-01-01T00:00:00Z")
const span = 2 * 365 * 86400e3

mkdirSync("raw", { recursive: true })

async function write(path, n, row) {
  const out = createWriteStream(path)
  for (let i = 0; i < n; i++) {
    if (!out.write(JSON.stringify(row(i)) + "\n")) await new Promise((r) => out.once("drain", r))
  }
  await new Promise((r) => out.end(r))
}

await write("raw/sales.json", 500_000, (i) => {
  const p = pick(products)
  const quantity = int(1, 20)
  return {
    id: i,
    date: new Date(t0 + rand() * span).toISOString(),
    region: pick(regions),
    customer: pick(customers),
    sku: p.sku,
    quantity,
    price: p.price,
    amount: Math.round(quantity * p.price * 100) / 100,
  }
})

await write("raw/events.json", 100_000, (i) => {
  const ts = new Date(t0 + rand() * span).toISOString()
  const user = pick(customers)
  switch (int(0, 3)) {
    case 0:
      return { ts, kind: "login", user, ip: `10.${int(0, 255)}.${int(0, 255)}.${int(1, 254)}`, mfa: rand() < 0.7 }
    case 1:
      return { ts, kind: "purchase", user, items: Array.from({ length: int(1, 5) }, () => ({ sku: pick(products).sku, qty: int(1, 9) })), total: Math.round(rand() * 5000 * 100) / 100 }
    case 2:
      return rand() < 0.5
        ? { ts, kind: "error", code: int(400, 599), message: "request failed" }
        : { ts, kind: "error", code: "TIMEOUT", message: "timed out", retry: { after_ms: int(100, 5000), attempt: int(1, 5) } }
    default:
      return { ts, kind: "note", user, text: `note ${i}`, tags: rand() < 0.5 ? ["a", "b"] : null }
  }
})
console.log("ok")

// Banc d'essai Node : taille des fichiers et coût de décodage côté client
// pour BSUP (super-ts), Arrow IPC (apache-arrow), Parquet (parquet-wasm) et NDJSON.
// Usage : node scripts/bench.mjs [dossier contenant sales.* et events.*]
import { readFileSync, existsSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { decodeBSUP, BSUPResults } from "../src/components/super-ts.js"
import { tableFromIPC } from "apache-arrow"
import { readParquet } from "parquet-wasm"

const dir = process.argv[2] ?? "dist/_file/data"
const find = (name) => {
  // Framework ajoute un hash au nom des fichiers générés : sales.<hash>.bsup
  for (const f of readdirSyncSafe(dir)) if (f.startsWith(name.split(".")[0] + ".") && f.endsWith("." + name.split(".").pop())) return `${dir}/${f}`
  throw new Error(`introuvable : ${name} dans ${dir}`)
}
import { readdirSync } from "node:fs"
function readdirSyncSafe(d) { return existsSync(d) ? readdirSync(d) : [] }

function time(label, fn, runs = 5) {
  fn() // échauffement
  const ts = []
  let out
  for (let i = 0; i < runs; i++) {
    const t = performance.now()
    out = fn()
    ts.push(performance.now() - t)
  }
  ts.sort((a, b) => a - b)
  console.log(`  ${label.padEnd(52)} ${ts[runs >> 1].toFixed(0).padStart(6)} ms`)
  return out
}
const mb = (n) => (n / 1e6).toFixed(1).padStart(5) + " Mo"
function size(label, bytes) {
  console.log(`  ${label.padEnd(10)} ${mb(bytes.length)}   gzip ${mb(gzipSync(bytes).length)}`)
}

console.log("\n== sales : 500 000 lignes tabulaires ==")
const bsup = new Uint8Array(readFileSync(find("sales.bsup")))
const arrow = new Uint8Array(readFileSync(find("sales.arrow")))
const parquet = new Uint8Array(readFileSync(find("sales.parquet")))
const ndjson = readFileSync("raw/sales.json")
size("BSUP", bsup); size("Arrow", arrow); size("Parquet", parquet); size("NDJSON", ndjson)

console.log("\n  -- décodage seul --")
time("BSUP   decodeBSUP → Value[]", () => decodeBSUP(bsup))
time("BSUP   BSUPResults (ouverture paresseuse)", () => new BSUPResults(bsup).length)
time("Arrow  tableFromIPC", () => tableFromIPC(arrow))
time("Parquet readParquet → tableFromIPC", () => tableFromIPC(readParquet(parquet).intoIPCStream()))
time("NDJSON split + JSON.parse", () => ndjson.toString().trimEnd().split("\n").map((l) => JSON.parse(l)))

console.log("\n  -- objets JS (ce qu'attendent Plot / Inputs.table) --")
time("BSUP   decodeBSUP + toJS()", () => decodeBSUP(bsup).map((v) => v.toJS()))
time("Arrow  tableFromIPC + toArray().map(toJSON)", () => tableFromIPC(arrow).toArray().map((r) => r.toJSON()))

console.log("\n  -- agrégat : somme(amount) par région --")
time("BSUP   decodeBSUP + toJS + boucle", () => {
  const m = new Map()
  for (const v of decodeBSUP(bsup)) { const o = v.toJS(); m.set(o.region, (m.get(o.region) ?? 0) + o.amount) }
  return m
})
time("Arrow  colonnes (getChild)", () => {
  const t = tableFromIPC(arrow), r = t.getChild("region"), x = t.getChild("amount"), m = new Map()
  for (let i = 0; i < t.numRows; i++) { const k = r.get(i); m.set(k, (m.get(k) ?? 0) + x.get(i)) }
  return m
})
time("Arrow  colonnes typées (toArray)", () => {
  const t = tableFromIPC(arrow), r = t.getChild("region").toArray(), x = t.getChild("amount").toArray(), m = new Map()
  for (let i = 0; i < x.length; i++) { const k = r[i]; m.set(k, (m.get(k) ?? 0) + x[i]) }
  return m
})

console.log("\n== events : 100 000 événements hétérogènes ==")
const ebsup = new Uint8Array(readFileSync(find("events.bsup")))
const earrow = new Uint8Array(readFileSync(find("events.arrow")))
size("BSUP", ebsup); size("Arrow*", earrow); size("NDJSON", readFileSync("raw/events.json"))
console.log("  * Arrow exige `fuse` : un seul schéma large, champs absents = null, code int|string fusionné")
time("BSUP   decodeBSUP + toJS()", () => decodeBSUP(ebsup).map((v) => v.toJS()))
time("Arrow  tableFromIPC + toArray().map(toJSON)", () => tableFromIPC(earrow).toArray().map((r) => r.toJSON()))
const sample = decodeBSUP(ebsup).find((v) => v.toJS().kind === "login").toJS()
const asample = tableFromIPC(earrow).toArray().map((r) => r.toJSON()).find((o) => o.kind === "login")
console.log("\n  un « login » via BSUP :", sample)
console.log("  un « login » via Arrow:", JSON.parse(JSON.stringify(asample, (k, v) => typeof v === "bigint" ? Number(v) : v)))

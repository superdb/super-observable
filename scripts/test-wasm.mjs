// Teste le pont wasm dans Node, sans fs (comme dans un navigateur).
import { readFileSync } from "node:fs"
import { decodeBSUP, formatValue } from "../src/components/super-ts.js"
const src = readFileSync(new URL("../src/lib/wasm_exec.js", import.meta.url), "utf8")
new Function(src)()
const go = new globalThis.Go()
let t = performance.now()
const ready = new Promise((r) => (globalThis.__superdbReady = r))
const { instance } = await WebAssembly.instantiate(readFileSync(new URL("../src/lib/super.wasm", import.meta.url)), go.importObject)
go.run(instance)
await ready
const db = globalThis.__superdb
console.log(`prêt en ${(performance.now() - t).toFixed(0)} ms, version ${db.version}`)
const reg = (name, path) => { const b = readFileSync(path); t = performance.now(); db.register(name, b); console.log(`register ${name} (${(b.length / 1e6).toFixed(1)} Mo) ${(performance.now() - t).toFixed(0)} ms`) }
reg("sales", process.argv[2]); reg("sales.parquet", process.argv[3]); reg("gha", process.argv[4])
console.log("names:", db.names())
async function q(query, fmt) {
  t = performance.now()
  try {
    const out = await db.run(query, fmt)
    const ms = (performance.now() - t).toFixed(0)
    const text = fmt ? new TextDecoder().decode(out) : decodeBSUP(out).map(formatValue).join("\n")
    console.log(`\n> ${query}   [${ms} ms]\n${text.slice(0, 500)}`)
  } catch (e) { console.log(`\n> ${query}\nERREUR: ${e.message.slice(0, 300)}`) }
}
await q("values 1+1")
await q("from sales | count()")
await q("from sales | aggregate total:=sum(amount) by region | sort -r total")
await q("select region, count(*) as n, round(avg(amount)) as average from sales group by region order by n desc limit 3")
await q("from 'sales.parquet' | count()")
await q("from gha | count() by type | sort -r count | head 3")
await q("from gha | head 2 | values {type, depot}", "csv")
await q("from absent | count()")
await q("from sales | ceci n'est pas du SuperSQL")
process.exit(0)

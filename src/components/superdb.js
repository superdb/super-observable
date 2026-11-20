// Intégration minimale SuperDB ↔ Observable Framework (niveau 1 : fichiers BSUP produits au build).
import { decodeBSUP, formatValue, formatTypeValue } from "./super-ts.js"

// Charge un FileAttachment BSUP et renvoie des objets JS prêts pour Plot / Inputs.table.
// Les valeurs super-typées restent accessibles via la propriété non énumérable `values`.
export async function loadBSUP(file) {
  const values = decodeBSUP(new Uint8Array(await file.arrayBuffer()))
  const rows = values.map((v) => v.toJS())
  Object.defineProperty(rows, "values", { value: values })
  return rows
}

// Résumé des types distincts d'un résultat BSUP (ce que JSON/Arrow perdent).
export function typesOf(rows) {
  const counts = new Map()
  for (const v of rows.values) {
    const t = formatTypeValue(v.type)
    counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
}

// Représentation SUP d'une ligne (identique à `super -s`).
export const sup = (rows, i) => formatValue(rows.values[i])

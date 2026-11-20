---
title: Banc d'essai
toc: {label: "Sommaire"}
---

# Banc d'essai dans le navigateur

Mesure, dans **ce** navigateur, le coût de transformer les octets déjà téléchargés
en objets JS (ce qu'attendent Plot et `Inputs.table`).

```js
import {decodeBSUP} from "../components/super-ts.js";
import * as Arrow from "npm:apache-arrow";
const files = {
  bsup: await FileAttachment("../data/sales.bsup").arrayBuffer(),
  arrow: await FileAttachment("../data/sales.arrow").arrayBuffer(),
  parquet: FileAttachment("../data/sales.parquet"),
  evBsup: await FileAttachment("../data/events.bsup").arrayBuffer(),
  evArrow: await FileAttachment("../data/events.arrow").arrayBuffer()
};
```

```js
const go = view(Inputs.button("Lancer (≈ 10-20 s)"));
```

```js
function timeit(fn, runs = 3) {
  fn();
  const ts = [];
  for (let i = 0; i < runs; i++) { const t = performance.now(); fn(); ts.push(performance.now() - t); }
  return Math.round(ts.sort((a, b) => a - b)[runs >> 1]);
}
const results = go ? await (async () => {
  const bsup = new Uint8Array(files.bsup), arrow = new Uint8Array(files.arrow);
  const t0 = performance.now(); await files.parquet.parquet(); const parquetMs = Math.round(performance.now() - t0);
  return [
    {format: "BSUP", étape: "décodage → Value[]", ms: timeit(() => decodeBSUP(bsup)), Mo: bsup.length / 1e6},
    {format: "BSUP", étape: "décodage + toJS()", ms: timeit(() => decodeBSUP(bsup).map((v) => v.toJS())), Mo: bsup.length / 1e6},
    {format: "Arrow", étape: "tableFromIPC", ms: timeit(() => Arrow.tableFromIPC(arrow)), Mo: arrow.length / 1e6},
    {format: "Arrow", étape: "tableFromIPC + toJSON()", ms: timeit(() => Arrow.tableFromIPC(arrow).toArray().map((r) => r.toJSON())), Mo: arrow.length / 1e6},
    {format: "BSUP (événements)", étape: "décodage + toJS()", ms: timeit(() => decodeBSUP(new Uint8Array(files.evBsup)).map((v) => v.toJS())), Mo: files.evBsup.byteLength / 1e6},
    {format: "Arrow (événements, fuse)", étape: "tableFromIPC + toJSON()", ms: timeit(() => Arrow.tableFromIPC(new Uint8Array(files.evArrow)).toArray().map((r) => r.toJSON())), Mo: files.evArrow.byteLength / 1e6},
    {format: "Parquet", étape: "FileAttachment.parquet() (1er appel, inclut chargement wasm)", ms: parquetMs, Mo: NaN}
  ];
})() : [];
```

```js
results.length ? Inputs.table(results, {format: {Mo: (d) => isNaN(d) ? "" : d.toFixed(1)}}) : html`<i>Cliquez sur le bouton.</i>`
```

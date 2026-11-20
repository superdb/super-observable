---
title: Benchmark
---

# In-browser benchmark

Measures, in **this** browser, the cost of turning already downloaded bytes
into JS objects (what Plot and `Inputs.table` expect).

```js
import {decodeBSUP} from "./components/super-ts.js";
import * as Arrow from "npm:apache-arrow";
const files = {
  bsup: await FileAttachment("data/sales.bsup").arrayBuffer(),
  arrow: await FileAttachment("data/sales.arrow").arrayBuffer(),
  parquet: FileAttachment("data/sales.parquet"),
  evBsup: await FileAttachment("data/events.bsup").arrayBuffer(),
  evArrow: await FileAttachment("data/events.arrow").arrayBuffer()
};
```

```js
const go = view(Inputs.button("Run (≈ 10–20 s)"));
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
    {format: "BSUP", step: "decode → Value[]", ms: timeit(() => decodeBSUP(bsup)), MB: bsup.length / 1e6},
    {format: "BSUP", step: "decode + toJS()", ms: timeit(() => decodeBSUP(bsup).map((v) => v.toJS())), MB: bsup.length / 1e6},
    {format: "Arrow", step: "tableFromIPC", ms: timeit(() => Arrow.tableFromIPC(arrow)), MB: arrow.length / 1e6},
    {format: "Arrow", step: "tableFromIPC + toJSON()", ms: timeit(() => Arrow.tableFromIPC(arrow).toArray().map((r) => r.toJSON())), MB: arrow.length / 1e6},
    {format: "BSUP (events)", step: "decode + toJS()", ms: timeit(() => decodeBSUP(new Uint8Array(files.evBsup)).map((v) => v.toJS())), MB: files.evBsup.byteLength / 1e6},
    {format: "Arrow (events, fuse)", step: "tableFromIPC + toJSON()", ms: timeit(() => Arrow.tableFromIPC(new Uint8Array(files.evArrow)).toArray().map((r) => r.toJSON())), MB: files.evArrow.byteLength / 1e6},
    {format: "Parquet", step: "FileAttachment.parquet() (first call, includes wasm load)", ms: parquetMs, MB: NaN}
  ];
})() : [];
```

```js
results.length ? Inputs.table(results, {format: {MB: (d) => isNaN(d) ? "" : d.toFixed(1)}}) : html`<i>Click the button.</i>`
```

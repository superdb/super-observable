---
title: Heterogeneous or homogeneous?
---

# BSUP or Parquet, depending on the shape of the data

Three public datasets, from the most irregular to the most regular, queried by the same engine (`super`, on the
command line, at build time) in different formats. What varies: the number of **shapes**
(distinct top-level types) relative to the number of rows.

```js
import {loadBSUP} from "./components/superdb.js";
import {i18n, datasetNames} from "./components/i18n.js";
const profiles = await loadBSUP(FileAttachment("data/comparison/profiles.bsup"));
const sizes = await loadBSUP(FileAttachment("data/comparison/sizes.bsup"));
const bench = [
  ...(await loadBSUP(FileAttachment("data/gha/bench.bsup"))),
  ...(await loadBSUP(FileAttachment("data/bluesky/bench.bsup"))),
  ...(await loadBSUP(FileAttachment("data/clickbench/bench.bsup")))
];
```

```js
const {number, mb, format, variant, fileLabel} = i18n("en");
const datasets = ["gha", "bluesky", "clickbench"];
const descriptions = {
  gha: "Nested GitHub events; one shape per event.",
  bluesky: "Bluesky firehose; fixed envelope, variable post content.",
  clickbench: "Flat web-log table, 105 columns; a single shape."
};
const formats = ["json.gz", "bsup", "parquet"].map(format);
```

<div class="grid grid-cols-3">
${profiles.map((p) => html`<div class="card">
  <h2>${datasetNames[p.dataset]}</h2>
  <span class="big">${number(p.shapes)}</span> shape${p.shapes > 1 ? "s" : ""}
  for ${number(p.rows)} rows<br>
  <span class="muted">${descriptions[p.dataset]}</span>
</div>`)}
</div>

## Size on disk

```js
const maxBytes = d3.max(sizes, (d) => d.bytes);
display(Plot.legend({color: {domain: formats}}));
for (const dataset of datasets) {
  const s = sizes.filter((d) => d.dataset === dataset);
  display(Plot.plot({
    title: datasetNames[dataset], marginLeft: 230, marginRight: 70, height: 30 + 26 * s.length,
    x: {label: "MB", grid: true, domain: [0, maxBytes / 1e6], transform: (d) => d / 1e6, axis: dataset === "clickbench" ? "bottom" : null},
    y: {label: null, domain: s.map(fileLabel)},
    color: {domain: formats},
    marks: [
      Plot.barX(s, {x: "bytes", y: fileLabel, fill: (d) => format(d.format), tip: {format: {x: (d) => mb(d * 1e6)}}}),
      Plot.text(s, {x: "bytes", y: fileLabel, text: (d) => mb(d.bytes, 0), dx: 4, textAnchor: "start"}),
      Plot.ruleX([0])
    ]
  }));
}
```

<p class="muted">On GHA, Parquet has to merge 22,845 shapes into one sparse schema: it is three times
the size of BSUP. On the flat ClickBench, the original Parquet (compressed by ClickHouse) is the smallest; the one
written by <code>super</code> is larger than BSUP. For Bluesky, only BSUP keeps every field: the full
file cannot be written as Parquet (<i>unsupported type: empty record</i>).</p>

## Query duration

Ratio *Parquet duration ÷ BSUP duration* for each query: above 1, BSUP is faster.
Queries from the [performance tutorial](https://superdb.org/tutorials/performance.html) for GHA, from
[JSONBench](https://github.com/ClickHouse/JSONBench) for Bluesky, from
[ClickBench](https://github.com/ClickHouse/ClickBench) for hits. Best of three runs; each run
includes `super` startup (about 10 ms).

```js
// Bluesky's reference is the BSUP without commit.record, the same content as its Parquet file.
const reference = new Map(bench.filter((d) => d.format === "bsup" && (d.variant ?? null) === (d.dataset === "bluesky" ? "no-record" : null))
  .map((d) => [`${d.dataset}/${d.test}`, d]));
const ratios = bench.filter((d) => d.format === "parquet" && d.ms != null).map((d) => {
  const b = reference.get(`${d.dataset}/${d.test}`);
  return {...d, bsupMs: b.ms, ratio: d.ms / b.ms, same: d.result === b.result, parquet: variant(d.variant)};
});
const colors = {domain: ["fused", "no-record", "super", "clickhouse"].map(variant)};
const symbols = {domain: ["same result", "different result"]};
display(Plot.legend({color: colors}));
display(Plot.legend({symbol: symbols}));
for (const dataset of datasets) {
  const r = ratios.filter((d) => d.dataset === dataset);
  display(Plot.plot({
    title: datasetNames[dataset], marginLeft: 60, height: 30 + 22 * new Set(r.map((d) => d.test)).size,
    x: {type: "log", domain: [0.45, 9], label: null, grid: true, ticks: [0.5, 1, 2, 4, 8], tickFormat: (d) => d + "×", axis: dataset === "clickbench" ? "bottom" : null},
    y: {label: null, domain: [...new Set(r.map((d) => d.test))]},
    color: colors, symbol: symbols,
    marks: [
      Plot.ruleX([1]),
      Plot.dot(r, {x: "ratio", y: "test", stroke: "parquet", symbol: (d) => (d.same ? "same result" : "different result"), r: 5, strokeWidth: 2,
        tip: {channels: {bsup: {value: "bsupMs", label: "BSUP (ms)"}, pq: {value: "ms", label: "Parquet (ms)"}}, format: {x: (d) => d.toFixed(1) + "×"}}})
    ]
  }));
}
display(html`<p class="muted">Parquet duration ÷ BSUP duration, log scale.</p>`);
```

<p class="muted">The original ClickBench Parquet stores text as <code>bytes</code> (without a string annotation):
on this file, Q12 and Q20 give wrong answers (no search phrase, 0 URLs containing “google”) and Q33 returns URLs in
hexadecimal. Its durations are therefore not comparable for these queries (“different result” symbol). The BSUP
and the Parquet “written by super” start from a typed conversion (<code>queries/hits-cast.spq</code>).</p>

```js
const chosen = view(Inputs.select(datasets, {label: "Dataset", format: (d) => datasetNames[d], value: "clickbench"}));
```

```js
const rows = bench.filter((d) => d.dataset === chosen);
const tests = [...new Set(rows.map((d) => d.test))];
const files = [...new Set(rows.map(fileLabel))];
const table = tests.map((test) => Object.fromEntries([["query", test], ...files.map((f) => [f, rows.find((d) => d.test === test && fileLabel(d) === f)?.ms ?? null])]));
display(Inputs.table(table, {format: Object.fromEntries(files.map((f) => [f, (d) => (d == null ? "failed" : d + " ms")])), layout: "auto"}));
```

<details><summary>Query text</summary>

```js
display(html`${tests.map((t) => html`<p><b>${t}</b></p><pre>${rows.find((d) => d.test === t).query}</pre>`)}`);
```

</details>

## Takeaways

- **Heterogeneous (GHA)**: BSUP is 3 times smaller than the fused Parquet and faster on every query;
  Parquet is not even a natural option, since a schema has to be invented first.
- **Semi-structured (Bluesky)**: Parquet only accepts the dataset after removing its irregular part
  (`commit.record`); even then, the JSONBench queries are 2 to 4 times slower than with BSUP.
- **Flat (ClickBench)**: Parquet's home turf. The ClickHouse file is the most compact, and its
  durations stay close to BSUP's on aggregations; the one written by `super` is larger and clearly
  slower. String queries also need correct text types to make sense.
- All numbers come from a single engine (`super`) on a single machine: this compares
  **formats**, not engines.

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
</style>

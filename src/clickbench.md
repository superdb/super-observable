---
title: ClickBench (hits_0)
---

# ClickBench: one million web hits, one single shape

The first of the 100 files of [ClickBench](https://github.com/ClickHouse/ClickBench)'s `hits` table:
one million page views anonymized from Yandex.Metrica, over a single day (July 15, 2013, Moscow time).
It is the opposite of GHA: a flat table of 105 columns where every row has exactly the same type.
This is Parquet's home turf, and the reference for analytical databases.

```js
import {loadBSUP} from "./components/superdb.js";
import {i18n} from "./components/i18n.js";
const columns = await loadBSUP(FileAttachment("data/clickbench/columns.bsup"));
const traffic = await loadBSUP(FileAttachment("data/clickbench/traffic.bsup"));
const sizes = await loadBSUP(FileAttachment("data/clickbench/sizes.bsup"));
const bench = await loadBSUP(FileAttachment("data/clickbench/bench.bsup"));
const profile = (await loadBSUP(FileAttachment("data/comparison/profiles.bsup"))).find((d) => d.dataset === "clickbench");
```

```js
const {number, mb, pct, fileLabel} = i18n("en");
const typeName = (t) => t.replace(/^<|>$/g, "");
const types = ["int16", "int32", "int64", "uint16", "string"];
const empty = columns.filter((d) => !d.filled);
const size = (format, variant = null) => sizes.find((d) => d.format === format && (d.variant ?? null) === variant).bytes;
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Hits</h2><span class="big">${number(profile.rows)}</span><br>one day of traffic</div>
  <div class="card"><h2>Distinct shapes</h2><span class="big">${number(profile.shapes)}</span><br>${columns.length} columns, all flat</div>
  <div class="card"><h2>Empty columns</h2><span class="big">${empty.length}</span><br>only 0 or "" in every row</div>
  <div class="card"><h2>BSUP</h2><span class="big">${mb(size("bsup"))}</span><br>vs ${mb(size("parquet", "clickhouse"))} for ClickHouse's Parquet</div>
</div>

## 105 columns, many of them nearly empty

Each bar is a column, sorted by the share of rows holding something other than `0` or `""`.
The table is wide but sparse: a columnar format compresses these constant columns down to almost nothing.

```js
display(Plot.plot({
  height: 260, marginBottom: 20,
  x: {label: null, axis: null, domain: columns.map((d) => d.column)},
  y: {label: "Rows with a value", grid: true, percent: true},
  color: {legend: true, domain: types},
  marks: [
    Plot.barY(columns, {x: "column", y: (d) => (d.filled ?? 0) / profile.rows, fill: (d) => typeName(d.type), inset: 0.5,
      tip: {channels: {column: "column", rows: {value: (d) => number(d.filled ?? 0), label: "rows"}}, format: {x: false}}}),
    Plot.ruleY([0])
  ]
}));
```

<p class="muted">Empty columns: ${empty.map((d) => d.column).sort().join(", ")}.
${columns.filter((d) => typeName(d.type) === "string").length} columns are strings: in the original Parquet file they are
stored as <code>bytes</code>, which matters below.</p>

## Traffic over the day

```js
Plot.plot({
  height: 240,
  x: {label: "Moscow time", type: "utc", tickFormat: "%H:%M"},
  y: {label: "Hits per 10 minutes", grid: true, tickFormat: "~s"},
  color: {legend: true, domain: ["desktop", "mobile"]},
  marks: [Plot.areaY(traffic, {x: "t", y: "n", fill: (d) => (d.mobile ? "mobile" : "desktop"), order: ["desktop", "mobile"], tip: true}), Plot.ruleY([0])]
})
```

## The same table in three files

```js
Plot.plot({
  marginLeft: 200, marginRight: 70, height: 120,
  x: {label: "Size (MB)", grid: true, transform: (d) => d / 1e6},
  y: {label: null, domain: sizes.map(fileLabel)},
  marks: [
    Plot.barX(sizes, {x: "bytes", y: fileLabel, fill: "var(--theme-foreground-focus)", tip: {format: {x: (d) => mb(d * 1e6)}}}),
    Plot.text(sizes, {x: "bytes", y: fileLabel, text: (d) => mb(d.bytes), dx: 4, textAnchor: "start"}),
    Plot.ruleX([0])
  ]
})
```

<p class="muted">The BSUP and the Parquet “written by super” come from a typed conversion of the original file
(<code>queries/hits-cast.spq</code>: <code>bytes</code> → <code>string</code>, no <code>null</code> unions).
ClickHouse's file is the most compact.</p>

## Seven ClickBench queries

A sample of the 43 ClickBench queries (original numbering), run at build time by `super` (${bench[0].version}),
best of three runs. A hollow bar means the result differs from BSUP's.

```js
const tests = [...new Set(bench.map((d) => d.test))];
const series = [...new Set(bench.map(fileLabel))];
const reference = new Map(bench.filter((d) => d.format === "bsup").map((d) => [d.test, d.result]));
const same = (d) => d.result === reference.get(d.test);
display(Plot.plot({
  marginLeft: 50, height: 340,
  x: {label: "Duration (ms)", grid: true},
  y: {label: null, axis: null, domain: series},
  fy: {label: null, axis: "left", domain: tests},
  color: {legend: true, domain: series},
  marks: [
    Plot.barX(bench.filter(same), {x: "ms", y: fileLabel, fy: "test", fill: fileLabel, tip: true}),
    Plot.barX(bench.filter((d) => !same(d)), {x: "ms", y: fileLabel, fy: "test", fill: "none", stroke: fileLabel, strokeWidth: 1.5, inset: 1,
      tip: {channels: {result: {value: () => "different", label: "result"}}}}),
    Plot.ruleX([0])
  ]
}));
```

```js
const q = view(Inputs.select(tests, {label: "Query", value: "Q33"}));
```

```js
const rows = bench.filter((d) => d.test === q);
display(html`<pre>${rows[0].query}</pre>
<div class="grid grid-cols-3">${rows.map((d) => html`<div><b>${fileLabel(d)}</b> — ${d.ms} ms
${same(d) ? "" : html` <span class="different">different result</span>`}<pre class="result">${d.result || "(no rows)"}</pre></div>`)}</div>`);
```

<p class="muted">On ClickHouse's Parquet, strings are untyped <code>bytes</code>: Q12 finds no search phrase,
Q20 finds no URL containing “google” and Q33 returns URLs in hexadecimal. Its durations for these queries are not comparable.</p>

## Explore the searches in the browser (wasm engine)

The ${number(total)} hits that carry a search phrase, reduced to a few fields at build time,
are loaded into the SuperDB engine running in the page. The phrases are in Russian.

```js
import {SuperDBClient, literal} from "./components/superdb-client.js";
const db = await SuperDBClient.of({searches: FileAttachment("data/clickbench/searches.bsup")});
const total = (await db.sql`from searches | aggregate n:=count()`)[0].n;
```

```js
const filters = view(Inputs.form({
  text: Inputs.text({label: "Search the phrases", placeholder: "e.g. фильм, рецепт, москва…"}),
  mobile: Inputs.select([null, false, true], {label: "Device", format: (d) => (d === null ? "(all)" : d ? "mobile" : "desktop")})
}));
```

```js
const conditions = [];
if (filters.text) conditions.push(`grep(${literal(filters.text)}, phrase)`);
if (filters.mobile !== null) conditions.push(`mobile = ${filters.mobile}`);
const where = conditions.length ? ` | where ${conditions.join(" and ")}` : "";
const summary = await db.query(`from searches${where} | aggregate n:=count(), phrases:=count(distinct phrase), users:=count(distinct user), regions:=count(distinct region)`);
const summaryMs = db.lastMs;
const topPhrases = await db.query(`from searches${where} | aggregate n:=count() by phrase | sort -r n, phrase | limit 12`);
const perHour = await db.query(`from searches${where} | aggregate n:=count() by t:=bucket(ts, 1h) | sort t`);
```

<p>${number(summary[0].n)} searches out of ${number(total)}, ${number(summary[0].phrases)} distinct phrases,
${number(summary[0].users)} users, ${number(summary[0].regions)} regions
<span class="muted">— query took ${summaryMs.toFixed(0)} ms in the engine</span></p>

<pre class="muted">from searches${where}</pre>

<div class="grid grid-cols-2">
<div>

```js
display(resize((width) => topPhrases.length
  ? Plot.plot({
      width, title: "Most frequent phrases", marginLeft: 230, height: 40 + 22 * topPhrases.length,
      x: {label: "Searches", grid: true},
      y: {label: null, domain: topPhrases.map((d) => d.phrase), tickFormat: (d) => (d.length > 34 ? d.slice(0, 33) + "…" : d)},
      marks: [Plot.barX(topPhrases, {x: "n", y: "phrase", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
    })
  : html`<p class="muted">No searches for these filters.</p>`));
```

</div>
<div>

```js
display(resize((width) => Plot.plot({
  width, title: "Searches per hour (Moscow time)", height: 300,
  x: {label: null, type: "utc", tickFormat: "%H:%M"},
  y: {label: null, grid: true},
  marks: [Plot.rectY(perHour, {x1: "t", x2: (d) => new Date(+d.t + 36e5), y: "n", fill: "var(--theme-foreground-focus)", inset: 0.5, tip: true}), Plot.ruleY([0])]
})));
```

</div>
</div>

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
.different { color: var(--theme-red); }
pre.result { max-height: 18rem; overflow: auto; font-size: 0.75rem; }
</style>

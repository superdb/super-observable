---
title: GitHub Archive (GHA)
---

# GitHub Archive: the “GHA Sample”

The sample of [GitHub Archive](https://www.gharchive.org/) events the SuperDB team uses for its
benchmarks (issues [#7503](https://github.com/superdb/super/issues/7503),
[#7070](https://github.com/superdb/super/issues/7070), [#7152](https://github.com/superdb/super/issues/7152),
the [performance](https://superdb.org/tutorials/performance.html) tutorial): GitHub events from
February 8, 2023, in JSON. The data is nested and irregular, with fields that come and go —
which is what makes it the “acid test” of a query engine.

```js
import {loadBSUP} from "./components/superdb.js";
import {i18n} from "./components/i18n.js";
const shapes = await loadBSUP(FileAttachment("data/gha/shapes.bsup"));
const sizes = await loadBSUP(FileAttachment("data/gha/sizes.bsup"));
const bench = await loadBSUP(FileAttachment("data/gha/bench.bsup"));
const events = await loadBSUP(FileAttachment("data/gha/events.bsup"));
```

```js
const {number, mb, fileLabel} = i18n("en");
const total = d3.sum(shapes, (d) => d.n);
const totalShapes = d3.sum(shapes, (d) => d.shapes);
const size = (format, variant = null) => sizes.find((d) => d.format === format && d.variant === variant).bytes;
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Events</h2><span class="big">${number(total)}</span><br>${shapes.length} event types</div>
  <div class="card"><h2>Distinct shapes</h2><span class="big">${number(totalShapes)}</span><br>one per event</div>
  <div class="card"><h2>BSUP</h2><span class="big">${mb(size("bsup"))}</span><br>no schema to impose</div>
  <div class="card"><h2>Parquet</h2><span class="big">${mb(size("parquet", "fused"))}</span><br>after <code>fuse</code> into a single schema</div>
</div>

## Why it is hard: one shape per event

Every event in the sample has a type (a “shape”) that differs from all the others: an `org` field
present or not, a `milestone` that is null or filled in, empty lists or not… Even within a single
event type, the `payload` changes on almost every row. A relational database has to merge everything
into one sparse schema; SuperDB keeps each value with its exact type.

```js
Plot.plot({
  marginLeft: 210, height: 420,
  x: {type: "log", label: "Count (log scale)", grid: true, tickFormat: "~s"},
  y: {axis: null, domain: ["events", "payload shapes"]},
  fy: {label: null, axis: "left", domain: shapes.map((d) => d.type)},
  color: {legend: true, domain: ["events", "payload shapes"]},
  marks: [
    Plot.barX(shapes.flatMap((d) => [{type: d.type, measure: "events", n: d.n}, {type: d.type, measure: "payload shapes", n: d.payload_shapes}]),
      {x1: 0.8, x2: "n", y: "measure", fy: "type", fill: "measure", tip: {channels: {n: "n"}}})
  ]
})
```

<p class="muted">Events equal shapes exactly for every type, which suggests the sample was built by keeping one
event per distinct shape of the day. The breakdown by type is therefore not representative of real GitHub
activity (pull requests dominate it).</p>

## The same sample in three formats

```js
Plot.plot({
  marginLeft: 150, marginRight: 70, height: 170,
  x: {label: "Size (MB)", grid: true, transform: (d) => d / 1e6},
  y: {label: null, domain: sizes.map(fileLabel)},
  marks: [
    Plot.barX(sizes, {x: "bytes", y: fileLabel, fill: "var(--theme-foreground-focus)", tip: {format: {x: (d) => mb(d * 1e6)}}}),
    Plot.text(sizes, {x: "bytes", y: fileLabel, text: (d) => mb(d.bytes), dx: 4, textAnchor: "start"}),
    Plot.ruleX([0])
  ]
})
```

<p class="muted">Parquet has to merge these thousands of shapes into one very wide, nearly empty schema,
hence its size. The BSUP projection (${mb(size("bsup", "projection"))}) is what the browser loads below.</p>

## The five benchmark queries

The queries from the [performance](https://superdb.org/tutorials/performance.html) tutorial, run at build
time by `super` (${bench[0].version}) on the full sample, best of three runs.
*search+* uses `grep('…', this)`: on main, `grep` now requires two arguments.

```js
Plot.plot({
  marginLeft: 70, height: 230,
  x: {label: "Duration (ms)", grid: true},
  y: {label: null, axis: null},
  fy: {label: null, axis: "left", domain: ["search", "search+", "count", "agg", "union"]},
  color: {legend: true, domain: ["bsup", "parquet"]},
  marks: [
    Plot.barX(bench, {x: "ms", y: "format", fy: "test", fill: "format", tip: true}),
    Plot.ruleX([0])
  ]
})
```

```js
const test = view(Inputs.select(["search", "search+", "count", "agg", "union"], {label: "Query", value: "union"}));
```

```js
const row = bench.find((d) => d.test === test && d.format === "bsup");
display(html`<pre>${row.query}</pre><p>Result (identical with Parquet):</p><pre>${row.result || "(no rows: this repository is not in the sample)"}</pre>`);
```

## Activity over the day

A projection with one row per event (actor, repository, title, language, labels, assignees…),
computed at build time with `coalesce` over fields that only exist for some event types.

```js
const main = shapes.slice(0, 5).map((d) => d.type);
const shownType = (d) => main.includes(d.type) ? d.type : "others";
display(Plot.plot({
  height: 260,
  x: {label: "Hour (UTC)", type: "utc", tickFormat: "%H:00"},
  y: {label: "Events per hour", grid: true},
  color: {legend: true, domain: [...main, "others"]},
  marks: [
    Plot.rectY(events, Plot.binX({y: "count"}, {x: "ts", interval: "hour", fill: shownType, tip: true})),
    Plot.ruleY([0])
  ]
}));
```

<div class="grid grid-cols-2">
<div>

```js
const languages = d3.rollups(events.filter((d) => d.language), (v) => v.length, (d) => d.language)
  .map(([language, n]) => ({language, n})).sort((a, b) => b.n - a.n).slice(0, 12);
display(resize((width) => Plot.plot({
  width, title: "Repository language (pull requests and reviews)",
  marginLeft: 90, height: 300,
  x: {label: "Events", grid: true},
  y: {label: null, domain: languages.map((d) => d.language)},
  marks: [Plot.barX(languages, {x: "n", y: "language", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
})));
```

</div>
<div>

```js
const reviews = d3.rollups(events.filter((d) => d.review), (v) => v.length, (d) => d.review)
  .map(([review, n]) => ({review, n})).sort((a, b) => b.n - a.n);
display(resize((width) => Plot.plot({
  width, title: "Code review state",
  marginLeft: 130, height: 300,
  x: {label: "Reviews", grid: true},
  y: {label: null, domain: reviews.map((d) => d.review)},
  marks: [Plot.barX(reviews, {x: "n", y: "review", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
})));
```

</div>
</div>

## Explore in the browser (wasm engine)

The projection is loaded into the SuperDB engine running in the page; every search is a
SuperSQL query.

```js
import {SuperDBClient, literal} from "./components/superdb-client.js";
const db = await SuperDBClient.of({gha: FileAttachment("data/gha/events.bsup")});
const allLanguages = (await db.sql`from gha | where language is not null | aggregate n:=count() by language | sort -r n`).map((d) => d.language);
```

```js
const filters = view(Inputs.form({
  text: Inputs.text({label: "Search (title, labels)", placeholder: "e.g. bump, security, rust…"}),
  language: Inputs.select([null, ...allLanguages], {label: "Language", format: (d) => d ?? "(all)"}),
  type: Inputs.select([null, ...shapes.map((d) => d.type)], {label: "Type", format: (d) => d ?? "(all)"})
}));
```

```js
const conditions = ["true"];
if (filters.text) conditions.push(`grep(${literal(filters.text)}, {title, labels})`);
if (filters.language) conditions.push(`language = ${literal(filters.language)}`);
if (filters.type) conditions.push(`type = ${literal(filters.type)}`);
const where = conditions.join(" and ");
const summary = await db.query(`from gha | where ${where} | aggregate n:=count(), repos:=count(distinct repo), actors:=count(distinct actor)`);
const summaryMs = db.lastMs;
const assignees = await db.query(`from gha | where ${where} | unnest assignees | aggregate n:=count() by assignee:=this | sort -r n, assignee | limit 10`);
const found = await db.query(`from gha | where ${where} | sort -r ts | limit 500 | values {ts, type, actor, repo, title, language, labels}`);
```

<p>${number(summary[0].n)} events, ${number(summary[0].repos)} repositories, ${number(summary[0].actors)} actors
<span class="muted">— query took ${summaryMs.toFixed(0)} ms in the engine</span></p>

<pre class="muted">from gha${conditions.length > 1 ? ` | where ${conditions.slice(1).join(" and ")}` : ""}</pre>

```js
assignees.length
  ? Plot.plot({
      title: "Most frequent assignees",
      marginLeft: 130, height: 40 + 22 * assignees.length,
      x: {label: "Assignments", grid: true},
      y: {label: null, domain: assignees.map((d) => d.assignee)},
      marks: [Plot.barX(assignees, {x: "n", y: "assignee", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
    })
  : html`<p class="muted">No assignees for these filters.</p>`
```

```js
Inputs.table(found, {
  rows: 12,
  columns: ["ts", "type", "repo", "title", "language"],
  format: {ts: (d) => d.toISOString().slice(11, 19), type: (d) => d.replace(/Event$/, "")},
  header: {ts: "time (UTC)", repo: "repository"},
  layout: "auto"
})
```

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
</style>

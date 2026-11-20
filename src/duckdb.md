---
title: SuperDB vs DuckDB
---

# SuperDB vs DuckDB, same data, same questions

DuckDB is the engine SuperDB is most often compared with: an embedded, single-binary SQL engine that also reads JSON
and Parquet. This page puts both on the three datasets of this site, with **one rule: each engine runs with its default
settings**. When one of them fails or returns a wrong answer, that is the result. No tuning, no workaround.

```js
import {loadBSUP} from "./components/superdb.js";
import {i18n} from "./components/i18n.js";
const duel = await loadBSUP(FileAttachment("data/duckdb/duel.bsup"));
const duelOf = (test, engine) => duel.find((d) => d.dataset === "clickbench" && d.test === test && d.engine === engine && d.format === (engine === "superdb" ? "bsup" : "duckdb"));
const ingest = await loadBSUP(FileAttachment("data/duckdb/ingest.bsup"));
```

```js
const {number, mb} = i18n("en");
const engines = ["superdb", "duckdb"];
const engineName = {superdb: "SuperDB", duckdb: "DuckDB"};
const engineColor = {domain: engines, range: ["#4269d0", "#efb118"], tickFormat: (d) => engineName[d]};
const datasetName = {gha: "GitHub Archive (heterogeneous)", bluesky: "Bluesky (semi-structured)", clickbench: "ClickBench (flat table)"};
const kindOf = (d) => (d.format === "json.gz" ? "json" : d.format === "parquet" ? (d.variant === "clickhouse" ? "clickhouse" : "parquet") : "native");
const kindName = {json: "Raw JSON (json.gz)", native: "Native format (BSUP / .duckdb)", parquet: "The same Parquet file", clickhouse: "ClickHouse's Parquet (untyped strings)"};
const kinds = Object.keys(kindName);
const version = Object.fromEntries(engines.map((e) => [e, duel.find((d) => d.engine === e).version]));
const status = (d) => (d.error ? "failed" : d.same ? "ok" : "wrong");
const shortError = (e) => e.replace(/^(Invalid Input Error|Binder Error): /, "").split(/[.:]\s/)[0].slice(0, 70);

// One row per (dataset, kind, test): both engines side by side.
const pairs = d3.flatGroup(duel, (d) => d.dataset, kindOf, (d) => d.test).map(([dataset, kind, test, rows]) => {
  const [s, k] = engines.map((e) => rows.find((d) => d.engine === e));
  return {dataset, kind, test, superdb: s, duckdb: k, faster: s && k && !s.error && !k.error && s.same && k.same ? (s.ms <= k.ms ? "superdb" : "duckdb") : null};
});
const tally = (e) => ({
  wins: pairs.filter((p) => p.faster === e).length,
  failed: duel.filter((d) => d.engine === e && d.error).length,
  wrong: duel.filter((d) => d.engine === e && !d.error && !d.same).length
});
const score = Object.fromEntries(engines.map((e) => [e, tally(e)]));
const ing = (dataset, engine) => ingest.find((d) => d.dataset === dataset && d.engine === engine);
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Bluesky into a native database</h2><span class="big">${ing("bluesky", "duckdb").error ? "DuckDB ✕" : "both ✓"}</span><br>SuperDB: ${(ing("bluesky", "superdb").ms / 1000).toFixed(1)} s; DuckDB: ${ing("bluesky", "duckdb").error ? "schema inference error" : (ing("bluesky", "duckdb").ms / 1000).toFixed(1) + " s"}</div>
  <div class="card"><h2>Head-to-heads won</h2><span class="big">${score.superdb.wins} – ${score.duckdb.wins}</span><br>SuperDB – DuckDB, when both answer correctly</div>
  <div class="card"><h2>Queries failed</h2><span class="big">${score.superdb.failed} – ${score.duckdb.failed}</span><br>SuperDB – DuckDB, out of ${duel.length / 2} each</div>
  <div class="card"><h2>Wrong answers</h2><span class="big">${score.superdb.wrong} – ${score.duckdb.wrong}</span><br>SuperDB – DuckDB, all on ClickHouse's untyped Parquet</div>
</div>

<p class="muted">Command line, on this machine: <code>super</code> ${version.superdb} and <code>duckdb</code> ${version.duckdb}, best of three runs,
process start included for both. The reference answer for each question is SuperDB's on BSUP; the numbers in every
other answer are compared with it.</p>

## Step 1: load the data

Before querying, both engines can turn the raw files into their own native format: BSUP for SuperDB, a `.duckdb`
database for DuckDB. Same input, default settings (`CREATE TABLE … AS FROM 'file'` for DuckDB).

```js
const ingestRows = ingest.map((d) => ({...d, label: datasetName[d.dataset]}));
display(Plot.plot({
  marginLeft: 220, marginRight: 230, height: 210,
  x: {label: "Seconds", grid: true, transform: (d) => d / 1000},
  y: {axis: null, domain: engines},
  fy: {label: null, domain: Object.values(datasetName)},
  color: {...engineColor, legend: true},
  marks: [
    Plot.barX(ingestRows.filter((d) => !d.error), {x: "ms", y: "engine", fill: "engine", fy: "label", tip: {format: {y: false}}}),
    Plot.text(ingestRows.filter((d) => !d.error), {x: "ms", y: "engine", fy: "label", text: (d) => `${(d.ms / 1000).toFixed(1)} s → ${mb(d.bytes)}`, dx: 4, textAnchor: "start"}),
    Plot.text(ingestRows.filter((d) => d.error), {x: 0, y: "engine", fy: "label", text: (d) => `✕ ${engineName[d.engine]}: ${shortError(d.error)}`, fill: "var(--theme-red)", dx: 4, textAnchor: "start"}),
    Plot.ruleX([0])
  ]
}));
```

<details><summary>DuckDB's error on Bluesky</summary>
<pre class="error">${ing("bluesky", "duckdb").error ?? "none"}</pre>
DuckDB guesses a table schema from a sample of the file. A field that first appears after the sample (here on line
22,303 of a million) breaks the load. SuperDB has no schema to guess: each value carries its own type.
</details>

## Step 2: the same questions

Each line is a question; the dots are each engine's time (log scale, shorter is better), with how many times faster
the winner was. A hollow dot is a wrong answer, a ✕ a failure.

```js
const dataset = view(Inputs.radio(new Map(Object.entries(datasetName).map(([k, v]) => [v, k])), {label: "Dataset", value: "gha"}));
```

```js
const shown = pairs.filter((p) => p.dataset === dataset);
const rows = shown.flatMap((p) => engines.map((e) => p[e] && {...p[e], kind: p.kind}).filter(Boolean));
const ratio = (p) => Math.max(p.superdb.ms, p.duckdb.ms) / Math.max(1, Math.min(p.superdb.ms, p.duckdb.ms));
const tests = [...new Set(shown.map((p) => p.test))];
const kindsShown = kinds.filter((k) => shown.some((p) => p.kind === k));
display(resize((width) => Plot.plot({
  width, marginLeft: 70, marginRight: 10, marginTop: 30, height: kindsShown.length * (tests.length * 24 + 40),
  x: {type: "log", label: "Milliseconds (log scale)", grid: true, domain: [5, 5000], tickFormat: number},
  y: {label: null, domain: tests},
  fy: {label: null, domain: kindsShown, axis: null, padding: 0.3},
  color: {...engineColor, legend: true},
  marks: [
    Plot.text(kindsShown, {fy: (k) => k, text: (k) => kindName[k], frameAnchor: "top-left", dy: -18, dx: -66, fontWeight: 600, fontSize: 12}),
    Plot.link(shown.filter((p) => p.faster), {x1: (p) => p.superdb.ms, x2: (p) => p.duckdb.ms, y: "test", fy: "kind", stroke: "var(--theme-foreground-faint)"}),
    Plot.dot(rows.filter((d) => !d.error), {x: "ms", y: "test", fy: "kind", r: 5, stroke: "engine", strokeWidth: 2,
      fill: (d) => (d.same ? d.engine : "var(--theme-background)"),
      channels: {engine: {value: (d) => engineName[d.engine], label: "engine"}, file: "file", answer: {value: (d) => (d.same ? "correct" : "wrong"), label: "answer"}},
      tip: {format: {fill: false, stroke: false, fy: (k) => kindName[k]}}}),
    Plot.text(shown.filter((p) => p.faster), {x: (p) => Math.max(p.superdb.ms, p.duckdb.ms), y: "test", fy: "kind", dx: 9, textAnchor: "start",
      text: (p) => `×${ratio(p) < 10 ? ratio(p).toFixed(1) : Math.round(ratio(p))}`, fill: (p) => p.faster, fontWeight: 600}),
    Plot.text(rows.filter((d) => d.error), {frameAnchor: "right", y: "test", fy: "kind", dx: -4, dy: (d) => (d.engine === "superdb" ? -6 : 6),
      text: (d) => `✕ ${engineName[d.engine]}: ${shortError(d.error)}`, fill: "var(--theme-red)", textAnchor: "end"})
  ]
})));
```

<div class="card note">${dataset === "gha"
  ? html`Every GitHub event has its own shape. On the raw JSON SuperDB answers ${(d3.median(shown.filter((p) => p.kind === "json" && p.faster), (p) => p.duckdb.ms / p.superdb.ms)).toFixed(1)}× faster (median); once loaded, the two native formats are close, except for <code>search+</code>, a search for a phrase in every field: one <code>grep</code> in SuperDB, a cast of the whole row to text in DuckDB.`
  : dataset === "bluesky"
  ? html`DuckDB reads the raw JSON quickly, but with the same default settings it cannot load it into its own database (step 1), so there is nothing to query there. On Parquet, a format SuperDB wrote with the one field DuckDB cannot represent dropped (<code>commit.record</code>), DuckDB is faster.`
  : html`One shape, 105 flat columns: DuckDB's home turf. In native format, the light questions are a draw decided by process start (SuperDB ahead on Q0–Q8); on the heavy ones DuckDB pulls away (Q33: ${(+duelOf('Q33','superdb').ms/ +duelOf('Q33','duckdb').ms).toFixed(0)}× faster). On ClickHouse's Parquet, whose strings are untyped bytes, <em>both</em> engines stumble: SuperDB silently returns no rows for Q12 and a count of 0 instead of 95 for Q20, and shows Q33's URLs as hex bytes (with the right counts); DuckDB refuses Q20 with an error and shows Q12's phrases as escaped bytes (with the right counts).`}</div>

### The queries, side by side

```js
const test = view(Inputs.select(tests, {label: "Question"}));
const kind = view(Inputs.select(kindsShown, {label: "Files", format: (k) => kindName[k]}));
```

```js
const pick = shown.find((p) => p.test === test && p.kind === kind) ?? shown.find((p) => p.test === test);
display(html`<div class="grid grid-cols-2">${engines.map((e) => {
  const d = pick[e];
  return html`<div><h3 style="color: ${engineColor.range[engines.indexOf(e)]}">${engineName[e]}${d ? html` <span class="muted">— ${d.file}</span>` : ""}</h3>
  ${d ? html`<pre>${d.query}</pre>
  ${d.error ? html`<pre class="error">${d.error}</pre>` : html`<p>${number(d.ms)} ms${d.same ? "" : html` — <span class="error">wrong answer</span>`}</p><pre class="result">${d.result || "(no rows)"}</pre>`}` : html`<p class="muted">not run</p>`}</div>`;
})}</div>`);
```

## Step 3: in the browser

Observable Framework ships DuckDB-wasm (DuckDB-wasm 1.29, i.e. DuckDB 1.1.1); this site adds SuperDB
compiled to wasm. Both run in this page, on your machine.

### The same raw JSON file in both engines

The first 30,000 Bluesky events, untouched (${mb(blueskyBytes)}), handed as-is to both engines; then JSONBench's
first question (events by collection). DuckDB loads it with its default SQL, as on the command line:
`CREATE TABLE bluesky AS FROM read_json('bluesky.json')`.

```js
import {SuperDBClient} from "./components/superdb-client.js";
const blueskyFile = FileAttachment("data/duckdb/bluesky-30k.json");
const blueskyBytes = (await blueskyFile.arrayBuffer()).byteLength;
```

```js
const jsonGo = view(Inputs.button("Load and query in both engines"));
```

```js
const timed = async (fn) => {
  const t = performance.now();
  try {
    const value = await fn();
    return {ms: performance.now() - t, value};
  } catch (error) {
    return {ms: performance.now() - t, error: String(error.message ?? error).split("\n")[0]};
  }
};
const q1 = "SELECT commit.collection AS event, count(*) AS count FROM bluesky GROUP BY event ORDER BY count DESC";
const jsonRace = jsonGo ? await (async () => {
  const s = {}, k = {};
  const sload = await timed(() => SuperDBClient.of({bluesky: blueskyFile}));
  s.load = sload;
  if (!sload.error) s.query = await timed(() => sload.value.query(q1.replace("count(*)", "count()")));
  // DuckDB's default SQL, as on the command line: CREATE TABLE … AS FROM read_json(…)
  const kload = await timed(async () => {
    const client = await DuckDBClient.of();
    await client._db.registerFileURL("bluesky.json", new URL(await blueskyFile.url(), location).href, 4, false);
    await client.query("CREATE TABLE bluesky AS FROM read_json('bluesky.json')");
    return client;
  });
  k.load = kload;
  if (!kload.error) k.query = await timed(() => kload.value.query(q1));
  return {superdb: s, duckdb: k};
})() : null;
```

```js
const cell = (r) => (!r ? html`<span class="muted">—</span>` : r.error ? html`<span class="error">✕ ${r.error.slice(0, 160)}</span>` : html`${number(Math.round(r.ms))} ms`);
display(jsonRace
  ? html`<table class="race"><thead><tr><th></th><th>Load the 30,000 events</th><th>Events by collection</th><th>Answer</th></tr></thead>
    <tbody>${engines.map((e) => html`<tr><th>${engineName[e]}</th><td>${cell(jsonRace[e].load)}</td><td>${cell(jsonRace[e].query)}</td>
    <td>${jsonRace[e].query && !jsonRace[e].query.error ? [...jsonRace[e].query.value].slice(0, 3).map((d) => `${d.event}: ${number(Number(d.count))}`).join(", ") + "…" : ""}</td></tr>`)}</tbody></table>`
  : html`<p class="muted">Press the button: both engines download and load the same ${mb(blueskyBytes)} of JSON.</p>`);
```

### A race on flat data

The ${number(69354)} ClickBench searches, each engine in its preferred format: BSUP for SuperDB, Parquet for DuckDB.
Each question runs three times; the chart keeps the best time, decoding into JavaScript objects included.

```js
const raceGo = view(Inputs.button("Run the race (a few seconds)"));
```

```js
const raceQueries = [
  {name: "count", superdb: "SELECT count() FROM searches", duckdb: "SELECT count(*) FROM searches"},
  {name: "distinct", superdb: "SELECT count(DISTINCT phrase) AS phrases, count(DISTINCT user) AS users FROM searches", duckdb: "SELECT count(DISTINCT phrase) AS phrases, count(DISTINCT \"user\") AS users FROM searches"},
  {name: "top phrases", superdb: "SELECT phrase, count() AS n FROM searches GROUP BY phrase ORDER BY n DESC, phrase LIMIT 10", duckdb: "SELECT phrase, count(*) AS n FROM searches GROUP BY phrase ORDER BY n DESC, phrase LIMIT 10"},
  {name: "substring", superdb: "SELECT count() FROM searches WHERE phrase LIKE '%фильм%'", duckdb: "SELECT count(*) FROM searches WHERE phrase LIKE '%фильм%'"},
  {name: "by hour", superdb: "FROM searches | aggregate n:=count() by t:=bucket(ts, 1h) | sort t", duckdb: "SELECT date_trunc('hour', ts) AS t, count(*) AS n FROM searches GROUP BY t ORDER BY t"},
  {name: "by region", superdb: "SELECT region, count() AS n FROM searches GROUP BY region ORDER BY n DESC LIMIT 20", duckdb: "SELECT region, count(*) AS n FROM searches GROUP BY region ORDER BY n DESC LIMIT 20"}
];
const race = raceGo ? await (async () => {
  const sl = await timed(() => SuperDBClient.of({searches: FileAttachment("data/clickbench/searches.bsup")}));
  const kl = await timed(() => DuckDBClient.of({searches: FileAttachment("data/duckdb/searches.parquet")}));
  const out = [{name: "load", engine: "superdb", ms: sl.ms, error: sl.error}, {name: "load", engine: "duckdb", ms: kl.ms, error: kl.error}];
  for (const q of raceQueries) {
    for (const [e, load] of [["superdb", sl], ["duckdb", kl]]) {
      if (load.error) continue;
      let best = Infinity, error, rows;
      for (let i = 0; i < 3 && !error; i++) {
        const r = await timed(async () => [...(await load.value.query(q[e]))]);
        if (r.error) error = r.error;
        else { best = Math.min(best, r.ms); rows = r.value.length; }
      }
      out.push({name: q.name, engine: e, ms: error ? null : best, rows, error});
    }
  }
  return out;
})() : null;
```

```js
display(race
  ? Plot.plot({
      marginLeft: 90, marginRight: 60, height: 320,
      x: {label: "Milliseconds (best of three)", grid: true},
      y: {label: null, domain: ["load", ...raceQueries.map((q) => q.name)]},
      fy: {axis: null, domain: engines}, color: {...engineColor, legend: true},
      marks: [
        Plot.barX(race.filter((d) => d.ms != null), {x: "ms", y: "name", fill: "engine", fy: "engine", tip: {format: {fy: false}}}),
        Plot.text(race.filter((d) => d.ms != null), {x: "ms", y: "name", fy: "engine", text: (d) => `${number(Math.round(d.ms))} ms`, dx: 4, textAnchor: "start"}),
        Plot.text(race.filter((d) => d.error), {x: 0, y: "name", fy: "engine", text: (d) => `✕ ${d.error.slice(0, 80)}`, fill: "var(--theme-red)", dx: 4, textAnchor: "start"}),
        Plot.ruleX([0])
      ]
    })
  : html`<p class="muted">Press the button to race the two engines in this browser.</p>`);
```

<p class="muted">“load” includes downloading the engine (SuperDB's wasm is ${mb(6.8e6)} gzipped, DuckDB-wasm's about as large) unless the browser already cached it.
DuckDB 1.1's <code>date_trunc</code> does not accept nanosecond timestamps, the precision SuperDB writes in Parquet: the “by hour” error is that.</p>

## What it shows

- **Data that changes shape is SuperDB's ground.** No schema to infer, so nothing breaks when a rare field shows up;
  raw JSON is queried faster; one `grep` searches every field; `UNNEST [...a, b]` replaces a `UNION ALL` of two subqueries.
- **Flat, typed tables are DuckDB's.** On ClickBench its native format is several times faster, and its database files are
  smaller than BSUP. Parquet is a draw that depends on the question.
- **Types matter to both.** Neither engine can recover strings that a Parquet file stores as untyped bytes.

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
.error { color: var(--theme-red); }
pre.error { white-space: pre-wrap; }
.grid pre { white-space: pre-wrap; }
.note { font-size: 0.95rem; }
pre.result { max-height: 14rem; overflow: auto; font-size: 0.75rem; }
table.race td, table.race th { padding: 0.3rem 0.8rem; vertical-align: top; }
</style>

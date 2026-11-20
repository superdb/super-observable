---
title: Live SuperSQL
---

# Live SuperSQL (wasm engine)

The complete SuperDB engine runs **in the browser**, in a Web Worker (Go → wasm).
Sources are loaded once; each query then returns only its result, as BSUP.

```js
import {SuperDBClient} from "./components/superdb-client.js";
const t0 = performance.now();
const db = await SuperDBClient.of({
  sales: FileAttachment("data/sales.bsup"),
  events: FileAttachment("data/events.bsup"),
  gha: FileAttachment("data/gha/events.bsup")
});
const initMs = performance.now() - t0;
```

<p class="muted">Engine ${db.version}, ready in ${initMs.toFixed(0)} ms (including the wasm and source downloads).
Sources: ${(await db.describeTables()).map((d) => html`<code>${d.name}</code>`).reduce((a, b) => html`${a}, ${b}`)}.</p>

## Editor

```js
const examples = {
  "Sales by region": "from sales\n| aggregate total:=sum(amount), n:=count() by region\n| sort -r total",
  "SQL: top customers": "select customer, sum(amount) as total, count(*) as n\nfrom sales\ngroup by customer\norder by total desc\nlimit 10",
  "Events: shapes": "from events\n| count() by kind, shape:=typeof(this)\n| sort kind",
  "Errors: integer or string code": "from events\n| where kind='error'\n| aggregate n:=count() by code_type:=typeof(code), with_retry:=has(this, 'retry')\n| sort n",
  "GHA: most frequent labels": "from gha\n| unnest labels\n| aggregate n:=count() by label:=this\n| sort -r n\n| limit 15",
  "GHA: merged PRs by language": "from gha\n| where type=='PullRequestEvent' and action=='closed' and language is not null\n| aggregate merged:=count() filter (merged), closed:=count() by language\n| values {...this, rate:round(100*merged/closed)}\n| where closed >= 50\n| sort -r closed"
};
const example = view(Inputs.select(Object.keys(examples), {label: "Example"}));
```

```js
const query = view(Inputs.textarea({value: examples[example], rows: 7, width: "100%", submit: "Run (⌘↩)", monospace: true, spellcheck: false}));
```

```js
const result = await (async () => {
  const t = performance.now();
  try {
    const rows = await db.query(query);
    return {rows, engine: db.lastMs, total: performance.now() - t};
  } catch (error) {
    return {error};
  }
})();
```

```js
result.error
  ? html`<pre class="error">${result.error.message}</pre>`
  : html`<p class="muted">${result.rows.length.toLocaleString("en-US")} values — engine ${result.engine.toFixed(0)} ms, total with decoding ${result.total.toFixed(0)} ms</p>`
```

```js
result.error ? null : Inputs.table(result.rows, {rows: 12})
```

<details><summary>Result as SUP</summary>

```js
result.error ? null : html`<pre>${result.rows.values.slice(0, 50).map((v) => sup(v)).join("\n")}</pre>`
```

</details>

```js
import {formatValue as sup} from "./components/super-ts.js";
```

## Parameterized, reactive queries

The `db.sql` template inserts JS values as SuperSQL literals; the chart recomputes on every change.

```js
const regions = (await db.sql`from sales | aggregate n:=count() by region | sort region`).map((d) => d.region);
const region = view(Inputs.select(regions, {label: "Region"}));
const minimum = view(Inputs.range([0, 20000], {label: "Minimum amount", step: 500, value: 0}));
```

```js
const byMonth = await db.sql`
  from sales
  | where region = ${region} and amount >= ${minimum}
  | aggregate total:=sum(amount), n:=count() by month:=strftime('%Y-%m-01T00:00:00Z', date)::timestamp
  | sort month`;
const byMonthMs = db.lastMs;
```

```js
Plot.plot({
  height: 260,
  y: {label: `Sales, ${region} ($)`, grid: true, tickFormat: "s"},
  marks: [Plot.areaY(byMonth, {x: "month", y: "total", fillOpacity: 0.2}), Plot.lineY(byMonth, {x: "month", y: "total", tip: true}), Plot.ruleY([0])]
})
```

<p class="muted">Query took ${byMonthMs.toFixed(0)} ms in the engine.</p>

## Source schemas

```js
const source = view(Inputs.select((await db.describeTables()).map((d) => d.name), {label: "Source", value: "gha"}));
```

```js
Inputs.table(await db.describeColumns({table: source}), {rows: 12})
```

<style>
.muted { color: var(--theme-foreground-muted); }
pre.error { color: var(--theme-red); white-space: pre-wrap; }
</style>

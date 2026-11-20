---
title: BSUP demo
---

# SuperDB in Observable Framework

`.bsup` files are produced **at build time** by data loaders (`src/data/*.bsup.sh`)
that run `super`, then decoded in the browser by
[super-ts](https://github.com/superdb/super-ts) (19 kB gzip).

```js
import {loadBSUP, typesOf, sup} from "./components/superdb.js";
const sales = await loadBSUP(FileAttachment("data/sales.bsup"));
const events = await loadBSUP(FileAttachment("data/events.bsup"));
```

## Sales — ${sales.length.toLocaleString("en-US")} rows

```js
Plot.plot({
  marginLeft: 110,
  x: {label: "Total amount ($)", grid: true},
  marks: [Plot.barX(sales, Plot.groupY({x: "sum"}, {x: "amount", y: "region", sort: {y: "-x"}, tip: true}))]
})
```

```js
Plot.plot({
  marginLeft: 80,
  y: {label: "Sales per month ($)", grid: true},
  marks: [Plot.rectY(sales, Plot.binX({y: "sum"}, {x: "date", y: "amount", interval: "month", fill: "region", tip: true}))],
  color: {legend: true}
})
```

```js
Inputs.table(sales)
```

## Heterogeneous events — ${events.length.toLocaleString("en-US")} values

BSUP keeps **every shape** as is: no imposed schema, no null columns,
and `code` stays an integer *or* a string.

```js
Inputs.table(typesOf(events), {width: {count: 80}})
```

```js
Plot.plot({
  marginLeft: 60,
  marks: [Plot.barX(events, Plot.groupY({x: "count"}, {y: "kind", sort: {y: "-x"}, tip: true}))]
})
```

A few values as SUP (identical to `super -s`):

```js
html`<pre>${[0, 1, 2, 3, 4].map((i) => sup(events, i)).join("\n")}</pre>`
```

```js
Inputs.table(events.filter((d) => d.kind === "error"))
```

---
title: Bluesky (JSONBench)
---

# Bluesky: one million firehose events

The first file of the [JSONBench](https://github.com/ClickHouse/JSONBench) benchmark: one million raw
events from the Bluesky network (13 and a half minutes on November 21, 2024), in JSON. It is the dataset the
SuperDB team uses in issues [#7484](https://github.com/superdb/super/issues/7484) and
[#7480](https://github.com/superdb/super/issues/7480). It is much more homogeneous than GHA: the event
envelope never changes, and the irregularity is concentrated in post content.

```js
import {loadBSUP} from "./components/superdb.js";
import {i18n} from "./components/i18n.js";
const collections = await loadBSUP(FileAttachment("data/bluesky/collections.bsup"));
const flow = await loadBSUP(FileAttachment("data/bluesky/flow.bsup"));
const postShapes = await loadBSUP(FileAttachment("data/bluesky/shapes.bsup"));
const sizes = await loadBSUP(FileAttachment("data/bluesky/sizes.bsup"));
const bench = await loadBSUP(FileAttachment("data/bluesky/bench.bsup"));
const profile = (await loadBSUP(FileAttachment("data/comparison/profiles.bsup"))).find((d) => d.dataset === "bluesky");
```

```js
const {number, mb, pct, fileLabel} = i18n("en");
const short = (c) => c.replace(/^app\.bsky\./, "");
const total = d3.sum(collections, (d) => d.n);
const size = (format, variant) => sizes.find((d) => d.format === format && d.variant === variant).bytes;
const posts = collections.find((d) => d.collection === "app.bsky.feed.post");
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Events</h2><span class="big">${number(total)}</span><br>${collections.length} collections</div>
  <div class="card"><h2>Distinct shapes</h2><span class="big">${number(profile.shapes)}</span><br>${postShapes.length} of them for created posts</div>
  <div class="card"><h2>JSON (gzip)</h2><span class="big">${mb(size("json.gz", null))}</span><br>original file</div>
  <div class="card"><h2>BSUP</h2><span class="big">${mb(size("bsup", "full"))}</span><br>every field, exact types</div>
</div>

## Few collections, lots of volume

Likes and follows make up 80% of the traffic and have only two or three shapes. Posts are
ten times rarer but carry almost all the shapes: replies, images, links, quotes, videos…

```js
const order = collections.map((d) => short(d.collection));
```

<div class="grid grid-cols-2">
<div>

```js
display(resize((width) => Plot.plot({
  width, title: "Events per collection", marginLeft: 150, height: 380,
  x: {type: "log", label: "Events (log scale)", grid: true, tickFormat: "~s"},
  y: {label: null, domain: order},
  marks: [Plot.barX(collections, {x1: 1, x2: "n", y: (d) => short(d.collection), fill: "var(--theme-foreground-focus)", tip: {channels: {n: "n"}}})]
})));
```

</div>
<div>

```js
display(resize((width) => Plot.plot({
  width, title: "Distinct shapes per collection", marginLeft: 150, height: 380,
  x: {label: "Shapes", grid: true},
  y: {label: null, domain: order},
  marks: [Plot.barX(collections, {x: "shapes", y: (d) => short(d.collection), fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
})));
```

</div>
</div>

## The flow, second by second

```js
const top4 = collections.slice(0, 4).map((d) => d.collection);
const group = (c) => (top4.includes(c) ? short(c) : "others");
const grouped = d3.rollups(flow, (v) => d3.sum(v, (d) => d.n), (d) => +d.t, (d) => group(d.collection))
  .flatMap(([t, g]) => g.map(([collection, n]) => ({t: new Date(t), collection, perSecond: n / 10})));
display(Plot.plot({
  height: 260,
  x: {label: null, type: "utc", tickFormat: "%H:%M"},
  y: {label: "Events per second (10 s average)", grid: true},
  color: {legend: true, domain: [...top4.map(short), "others"]},
  marks: [Plot.areaY(grouped, {x: "t", y: "perSecond", fill: "collection", order: [...top4.map(short), "others"], tip: true}), Plot.ruleY([0])]
}));
```

## The ${number(postShapes.length)} shapes of a post

```js
const totalPosts = d3.sum(postShapes, (d) => d.n);
const top = postShapes.slice(0, 20).map((d, i) => ({...d, rank: i + 1, share: d.n / totalPosts}));
const coverage = (k) => d3.sum(postShapes.slice(0, k), (d) => d.n) / totalPosts;
```

The 5 most common shapes cover ${pct(coverage(5))} of posts and the top 20 cover ${pct(coverage(20))};
the remaining ${number(postShapes.length - 20)} share the rest. Hover over a bar to see the shape's fields.

```js
Plot.plot({
  marginLeft: 40, height: 420,
  x: {label: "Posts", grid: true},
  y: {label: "Rank", domain: top.map((d) => d.rank)},
  marks: [
    Plot.barX(top, {x: "n", y: "rank", fill: "var(--theme-foreground-focus)",
      tip: {format: {y: false}, channels: {share: {value: (d) => pct(d.share), label: "share"}, fields: {value: (d) => d.fields.join("\n"), label: "fields"}}}}),
    Plot.ruleX([0])
  ]
})
```

## The five JSONBench queries

Run at build time by `super` (${bench[0].version}), best of three runs, on three files:
the full BSUP, and a version without `commit.record` in BSUP and in Parquet. Parquet for the full file
is impossible: `fuse` produces a type containing empty records, which Parquet rejects
(*unsupported type: empty record*).

```js
const series = [...new Set(bench.map(fileLabel))];
display(Plot.plot({
  marginLeft: 40, height: 300,
  x: {label: "Duration (ms)", grid: true},
  y: {label: null, axis: null, domain: series},
  fy: {label: null, axis: "left", domain: ["q1", "q2", "q3", "q4", "q5"]},
  color: {legend: true, domain: series},
  marks: [Plot.barX(bench, {x: "ms", y: fileLabel, fy: "test", fill: fileLabel, tip: true}), Plot.ruleX([0])]
}));
```

```js
const q = view(Inputs.select(["q1", "q2", "q3", "q4", "q5"], {label: "Query", value: "q2"}));
```

```js
const row = bench.find((d) => d.test === q && d.variant === "full");
display(html`<pre>${row.query}</pre><p>Result (identical on all three files):</p><pre>${row.result}</pre>`);
```

<p class="muted">The file only covers part of the 16:00 (UTC) hour, so q3 has a single hour.
The JSONBench queries are adapted: <code>date_part('hour', (time_us*1000)::timestamp)</code>
replaces <code>EXTRACT(HOUR FROM …::time)</code> (the <code>time</code> type no longer exists on main).</p>

## Explore posts in the browser (wasm engine)

The ${number(posts.creates)} created posts, reduced to a few fields at build time, are loaded into the
SuperDB engine running in the page; every search is a SuperSQL query.

```js
import {SuperDBClient, literal} from "./components/superdb-client.js";
const db = await SuperDBClient.of({posts: FileAttachment("data/bluesky/posts.bsup")});
const langs = (await db.sql`from posts | where lang is not null | aggregate n:=count() by lang | sort -r n | limit 30`).map((d) => d.lang);
const medias = (await db.sql`from posts | aggregate n:=count() by media | sort -r n`).map((d) => d.media);
```

```js
const filters = view(Inputs.form({
  text: Inputs.text({label: "Search the text", placeholder: "e.g. bluesky, twitter, coffee…"}),
  lang: Inputs.select([null, ...langs], {label: "Language", format: (d) => d ?? "(all)"}),
  media: Inputs.select([null, ...medias], {label: "Attached media", format: (d) => d ?? "(all)"}),
  reply: Inputs.select([null, true, false], {label: "Reply", format: (d) => (d === null ? "(all)" : d ? "yes" : "no")})
}));
```

```js
const conditions = [];
if (filters.text) conditions.push(`grep(${literal(filters.text)}, text)`);
if (filters.lang) conditions.push(`lang = ${literal(filters.lang)}`);
if (filters.media) conditions.push(`media = ${literal(filters.media)}`);
if (filters.reply !== null) conditions.push(`reply = ${filters.reply}`);
const where = conditions.length ? ` | where ${conditions.join(" and ")}` : "";
const summary = await db.query(`from posts${where} | aggregate n:=count(), authors:=count(distinct author), replies:=count() filter (reply), length:=avg(length)`);
const summaryMs = db.lastMs;
const perBucket = await db.query(`from posts${where} | aggregate n:=count() by t:=bucket(ts, 30s) | sort t`);
const found = await db.query(`from posts${where} | sort -r ts | limit 500 | values {ts, lang, media, text}`);
```

<p>${number(summary[0].n)} posts, ${number(summary[0].authors)} authors,
${summary[0].n ? pct(summary[0].replies / summary[0].n) : "—"} replies,
${summary[0].n ? Math.round(summary[0].length) : "—"} characters on average
<span class="muted">— query took ${summaryMs.toFixed(0)} ms in the engine</span></p>

<pre class="muted">from posts${where}</pre>

```js
Plot.plot({
  height: 180,
  x: {label: null, type: "utc", tickFormat: "%H:%M"},
  y: {label: "Posts per 30 s", grid: true},
  marks: [Plot.rectY(perBucket, {x1: "t", x2: (d) => new Date(+d.t + 30e3), y: "n", fill: "var(--theme-foreground-focus)", inset: 0.5, tip: true}), Plot.ruleY([0])]
})
```

```js
Inputs.table(found, {
  rows: 12,
  format: {ts: (d) => d.toISOString().slice(11, 19)},
  header: {ts: "time (UTC)", lang: "language"},
  width: {ts: 90, lang: 80, media: 110},
  layout: "auto"
})
```

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
</style>

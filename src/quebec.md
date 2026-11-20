---
title: Quebec municipalities
---

# Quebec's 1,100 municipalities, in every shape

The [*Répertoire des municipalités du Québec*](https://www.donneesquebec.ca/recherche/dataset/repertoire-des-municipalites-du-quebec)
(MAMH), its population history since 1986, and the administrative boundaries at 1:100,000 (MRNF), all open data from
Données Québec. The loaders join and reshape the three sources with `super`, the map included: the polygons travel as
BSUP like everything else. This page is a tour of the charts Observable Framework can draw from them.

```js
import {loadBSUP} from "./components/superdb.js";
import {i18n, kinds} from "./components/i18n.js";
const municipalities = await loadBSUP(FileAttachment("data/quebec/municipalities.bsup"));
const history = await loadBSUP(FileAttachment("data/quebec/population.bsup"));
const geometry = await loadBSUP(FileAttachment("data/quebec/geometry.bsup"));
```

```js
const {number, pct, kind: kindName} = i18n("en");
const kindColor = {domain: kinds, tickFormat: kindName};
const byCode = new Map(municipalities.map((d) => [d.code, d]));
const feature = (d, properties) => ({type: "Feature", properties, geometry: {type: "MultiPolygon", coordinates: d.polygons}});
const munis = geometry.filter((d) => d.layer === "municipality" && byCode.has(d.code)).map((d) => feature(d, byCode.get(d.code)));
const regions = geometry.filter((d) => d.layer === "region").map((d) => feature(d, {code: d.code, name: d.name}));
const density = (d) => (d.land > 0 && d.population > 0 ? d.population / d.land : null);
const total = d3.sum(municipalities, (d) => d.population);
const top10 = d3.sum(municipalities.slice(0, 10), (d) => d.population);
const saints = municipalities.filter((d) => /^Sainte?-/.test(d.name));
const latest = d3.max(history, (d) => d.year);
const powers = [1, 10, 100, 1e3, 1e4, 1e5, 1e6];
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Local entities</h2><span class="big">${number(municipalities.length)}</span><br>${number(municipalities.filter((d) => ["city", "municipality", "parish", "township", "village"].includes(d.kind)).length)} of them local municipalities</div>
  <div class="card"><h2>Population (${latest})</h2><span class="big">${number(total)}</span><br>${pct(top10 / total)} in the ten largest cities</div>
  <div class="card"><h2>Land area</h2><span class="big">${number(Math.round(d3.sum(municipalities, (d) => d.land)))} km²</span><br>${number(Math.round(total / d3.sum(municipalities, (d) => d.land)))} inhabitants per km² on average</div>
  <div class="card"><h2>Named after a saint</h2><span class="big">${number(saints.length)}</span><br>${pct(saints.length / municipalities.length)} of the names start with Saint- or Sainte-</div>
</div>

## A map, two ways

A choropleth colors each municipality by its density (log scale); proportional circles show where the people are.
Hover for details.

```js
const zoom = view(Inputs.radio(new Map([["All of Quebec", "all"], ["Southern Quebec", "south"], ["Greater Montréal", "montreal"]]), {label: "Zoom", value: "south"}));
const show = view(Inputs.radio(new Map([["Density", "density"], ["Population", "population"]]), {label: "Show", value: "density"}));
```

```js
const domains = {
  all: {type: "FeatureCollection", features: regions},
  south: {type: "MultiPoint", coordinates: [[-79.6, 45], [-64.3, 49.3]]},
  montreal: {type: "MultiPoint", coordinates: [[-74.15, 45.3], [-73.25, 45.8]]}
};
const tipChannels = {
  name: {value: (d) => d.properties.name, label: "Name"},
  kind: {value: (d) => kindName(d.properties.kind), label: "Kind"},
  region: {value: (d) => d.properties.region, label: "Region"},
  population: {value: (d) => number(d.properties.population), label: "Population"},
  density: {value: (d) => (density(d.properties) ? number(Math.round(density(d.properties))) + " /km²" : "—"), label: "Density"}
};
display(resize((width) => Plot.plot({
  width, clip: true,
  projection: {type: "conic-conformal", parallels: [46, 60], rotate: [68.5, 0], domain: domains[zoom], inset: 8},
  color: show === "density"
    ? {type: "log", scheme: "blues", domain: [0.1, 5000], clamp: true, legend: true, label: "Inhabitants per km²", ticks: [0.1, 1, 10, 100, 1000], tickFormat: number}
    : {...kindColor, legend: true},
  r: {range: [0, zoom === "montreal" ? 40 : 28]},
  marks: [
    Plot.geo(munis, {fill: "var(--theme-foreground-faintest)", stroke: "var(--theme-background)", strokeWidth: 0.3}),
    show === "density"
      ? Plot.geo(munis, {fill: (d) => density(d.properties), stroke: "var(--theme-background)", strokeWidth: 0.3, tip: {channels: tipChannels, format: {fill: false}}})
      : Plot.dot(munis, Plot.centroid({r: (d) => d.properties.population, fill: (d) => d.properties.kind, fillOpacity: 0.75,
          stroke: "var(--theme-background)", strokeWidth: 0.5, sort: {channel: "-r"}, tip: {channels: tipChannels, format: {r: false, fill: false}}})),
    Plot.geo(regions, {stroke: "var(--theme-foreground)", strokeWidth: 0.7, strokeOpacity: 0.6})
  ]
})));
```

<p class="muted">${number(municipalities.length - munis.length)} very small entities have no polygon at this scale.
Unorganized territories (no residents) stay gray.</p>

## Population by region, municipality by municipality

A treemap: each rectangle is a municipality, its area proportional to its population, grouped by administrative region.

```js
display(resize((width) => {
  const height = Math.max(420, width * 0.6);
  const root = d3.treemap().size([width, height]).paddingOuter(1).paddingTop(17).paddingInner(1).round(true)(
    d3.hierarchy({children: d3.groups(municipalities, (d) => d.region).map(([name, children]) => ({name, children}))})
      .sum((d) => d.population ?? 0)
      .sort((a, b) => b.value - a.value)
  );
  const leaves = root.leaves().filter((d) => d.value > 0);
  return Plot.plot({
    width, height, margin: 0,
    x: {type: "identity"}, y: {type: "identity"},
    color: {...kindColor, legend: true},
    marks: [
      Plot.rect(leaves, {x1: "x0", x2: "x1", y1: "y0", y2: "y1", fill: (d) => d.data.kind, fillOpacity: 0.85,
        channels: {name: {value: (d) => d.data.name, label: "Name"}, region: {value: (d) => d.data.region, label: "Region"},
          population: {value: (d) => number(d.value), label: "Population"}},
        tip: {format: {x1: false, x2: false, y1: false, y2: false, fill: (k) => kindName(k)}}}),
      Plot.text(root.children, {x: (d) => d.x0 + 3, y: (d) => d.y0 + 9, textAnchor: "start", fontWeight: 600, fill: "currentColor",
        text: (d) => [`${d.data.name} · ${number(d.value)}`, d.data.name].find((t) => t.length * 6.5 < d.x1 - d.x0 - 4) ?? ""}),
      Plot.text(leaves.filter((d) => d.y1 - d.y0 > 28), {x: (d) => d.x0 + 4, y: (d) => d.y0 + 4, textAnchor: "start", lineAnchor: "top", fontSize: 11,
        fill: "var(--theme-foreground)", text: (d) => (d.data.name.length * 6 < d.x1 - d.x0 - 6 ? `${d.data.name}\n${number(d.value)}` : "")})
    ]
  });
}));
```

## Many municipalities, few people — and the reverse

The same kinds counted two ways, in waffles: one square is 5 entities on the left, 25,000 people on the right.
Most entities are rural *municipalités* and parishes; most people live in *villes*.

```js
const byKind = d3.rollups(municipalities, (v) => ({n: v.length, population: d3.sum(v, (d) => d.population)}), (d) => d.kind)
  .map(([kind, {n, population}]) => ({kind, n, population}));
const waffle = (width, y, unit, label) => Plot.plot({
  width, height: 330, marginLeft: 10, marginTop: 30, title: label,
  x: {axis: null}, y: {axis: null},
  color: kindColor,
  marks: [Plot.waffleY(byKind, {y, fill: "kind", unit, multiple: 16, gap: 1, rx: 1,
    tip: {channels: {kind: {value: (d) => kindName(d.kind), label: "Kind"}, [y]: {value: (d) => number(d[y]), label: y === "n" ? "Entities" : "Population"}},
      format: {fill: false, y: false}}})]
});
```

<div class="grid grid-cols-2">
  <div>${resize((width) => waffle(width, "n", 5, "Entities"))}</div>
  <div>${resize((width) => waffle(width, "population", 25000, "Population"))}</div>
</div>
<div>${Plot.legend({color: {...kindColor, type: "categorical"}})}</div>

## How big is a municipality?

A histogram on a log scale: the typical municipality has a little over a thousand residents, and a long tail goes up to Montréal.

```js
display(resize((width) => Plot.plot({
  width, height: 280,
  x: {type: "log", label: "Population", ticks: powers, tickFormat: number},
  y: {label: "Municipalities", grid: true},
  color: {...kindColor, legend: true},
  marks: [
    Plot.rectY(municipalities.filter((d) => d.population > 0), Plot.binX({y: "count"}, {
      x: "population", fill: "kind", thresholds: d3.range(0, 6.6, 0.2).map((e) => 10 ** e), insetLeft: 0.5, insetRight: 0.5,
      tip: {format: {fill: (k) => kindName(k)}}})),
    Plot.ruleY([0]),
    Plot.ruleX([d3.median(municipalities.filter((d) => d.population > 0), (d) => d.population)], {stroke: "currentColor", strokeDasharray: "3,3"}),
    Plot.text([d3.median(municipalities.filter((d) => d.population > 0), (d) => d.population)], {x: (d) => d, frameAnchor: "top", dy: -2, dx: 4, textAnchor: "start",
      text: (d) => `median: ${number(Math.round(d))}`})
  ]
})));
```

## Area against population

Each dot is a municipality (log–log). The contours show where they cluster. Type a name to find it on the chart and in the table below.

```js
const found = view(Inputs.search(municipalities, {placeholder: "Search a municipality, an MRC, a region…", columns: ["name", "mrc", "region"], format: (n) => `${number(n)} result${n === 1 ? "" : "s"}`}));
```

```js
const searching = found.length < municipalities.length;
const withBoth = municipalities.filter((d) => d.land > 0 && d.population > 0);
display(resize((width) => Plot.plot({
  width, height: 460, grid: true, marginLeft: 60,
  x: {type: "log", label: "Land area (km²)", ticks: [0.1, ...powers], tickFormat: number},
  y: {type: "log", label: "Population", ticks: powers, tickFormat: number},
  color: {...kindColor, legend: true},
  marks: [
    Plot.density(withBoth, {x: "land", y: "population", stroke: "var(--theme-foreground-faint)", strokeWidth: 0.6, thresholds: 8}),
    Plot.dot(withBoth, {x: "land", y: "population", fill: "kind", r: 2.5, fillOpacity: searching ? 0.15 : 0.7,
      channels: {name: {value: "name", label: "Name"}, region: {value: "region", label: "Region"}}, tip: !searching && {format: {fill: (k) => kindName(k)}}}),
    searching ? Plot.dot(found.filter((d) => d.land > 0 && d.population > 0), {x: "land", y: "population", fill: "kind", r: 4.5, stroke: "currentColor",
      channels: {name: {value: "name", label: "Name"}}, tip: {format: {fill: (k) => kindName(k)}}}) : null,
    Plot.text(withBoth.slice(0, 4), {x: "land", y: "population", text: "name", dx: 6, textAnchor: "start", fontWeight: 600, stroke: "var(--theme-background)", fill: "currentColor"})
  ]
})));
```

```js
Inputs.table(found, {
  rows: 10,
  columns: ["name", "kind", "region", "mrc", "population", "land", "founded", "demonym"],
  header: {name: "Name", kind: "Kind", region: "Region", mrc: "MRC", population: "Population", land: "Land (km²)", founded: "Constituted", demonym: "Demonym"},
  width: {founded: 96}, format: {kind: kindName, population: number, land: (d) => d?.toLocaleString("en-US"), founded: (d) => d?.toISOString().slice(0, 10)},
  sort: "population", reverse: true
})
```

## Density by region

A box plot per region: the box holds the middle half of its municipalities, the line is the median. Montréal and Laval are in a league of their own.

```js
Plot.plot({
  marginLeft: 210, height: 480,
  x: {type: "log", label: "Inhabitants per km²", grid: true, domain: [0.01, 1e4], ticks: [0.01, 0.1, ...powers.slice(0, 5)], tickFormat: number},
  clip: true,
  y: {label: null, domain: d3.groupSort(municipalities.filter((d) => density(d)), (v) => -d3.median(v, density), (d) => d.region)},
  marks: [
    Plot.boxX(municipalities.filter((d) => density(d)), {x: density, y: "region", fill: "var(--theme-foreground-focus)", fillOpacity: 0.25, r: 1.5})
  ]
})
```

## Forty years of population and mergers

```js
const counts = d3.rollups(history.filter((d) => d.population > 0), (v) => ({n: v.length, population: d3.sum(v, (d) => d.population)}), (d) => d.year)
  .map(([year, v]) => ({year, ...v})).sort((a, b) => a.year - b.year);
const year = (y) => new Date(Date.UTC(y, 0, 1));
```

<div class="grid grid-cols-2">
<div>

```js
display(resize((width) => Plot.plot({
  width, height: 260, title: "Number of municipal entities",
  x: {label: null, type: "utc"},
  y: {label: null, grid: true, domain: [1000, 1700], tickFormat: number},
  marks: [
    Plot.lineY(counts, {x: (d) => year(d.year), y: "n", curve: "step-after", stroke: "var(--theme-foreground-focus)", strokeWidth: 2, tip: {format: {x: "%Y", y: number}}}),
    Plot.ruleX([year(2002)], {stroke: "var(--theme-foreground-faint)", strokeDasharray: "3,3"}),
    Plot.text([year(2002)], {x: (d) => d, frameAnchor: "bottom", dx: 4, dy: -6, textAnchor: "start", text: () => "2002 municipal mergers"})
  ]
})));
```

</div>
<div>

```js
display(resize((width) => Plot.plot({
  width, height: 260, title: "Total population",
  x: {label: null, type: "utc"},
  y: {label: null, grid: true, domain: [0, 1e7], tickFormat: "~s"},
  marks: [
    Plot.areaY(counts, {x: (d) => year(d.year), y: "population", fill: "var(--theme-foreground-focus)", fillOpacity: 0.15, curve: "step-after"}),
    Plot.lineY(counts, {x: (d) => year(d.year), y: "population", stroke: "var(--theme-foreground-focus)", strokeWidth: 2, curve: "step-after", tip: {format: {x: "%Y", y: number}}}),
    Plot.ruleY([0])
  ]
})));
```

</div>
</div>

<p class="muted">The population figures are the ones set by government decree each year; the 2002 mergers took the province
from about 1,470 to 1,300 entities (some 2006 demergers partly undid them).</p>

### Growth by region since 2006 (small multiples)

Population of each region's current municipalities, 2006 = 100, sorted by growth. The gray line is the whole of Quebec.
Sudden jumps usually come from a community added to the count (an Indigenous reserve, for example), not from a baby boom.

```js
const regionOf = new Map(municipalities.map((d) => [d.code, d.region]));
const since = history.filter((d) => d.year >= 2006 && regionOf.has(d.code));
const indexed = (rows) => {
  const base = rows.find((d) => d.year === 2006)?.population;
  return rows.map((d) => ({...d, index: (100 * d.population) / base}));
};
const regionSeries = d3.groups(since, (d) => regionOf.get(d.code))
  .flatMap(([region, v]) => indexed(d3.rollups(v, (w) => d3.sum(w, (d) => d.population), (d) => d.year).map(([year, population]) => ({region, year, population})).sort((a, b) => a.year - b.year)));
const quebecSeries = indexed(d3.rollups(since, (w) => d3.sum(w, (d) => d.population), (d) => d.year).map(([year, population]) => ({year, population})).sort((a, b) => a.year - b.year));
const order = d3.groupSort(regionSeries, (v) => -v.at(-1).index, (d) => d.region);
const columns = 6;
const cell = (region) => ({fx: order.indexOf(region) % columns, fy: Math.floor(order.indexOf(region) / columns)});
```

```js
display(resize((width) => Plot.plot({
  width, height: 3 * 150, marginLeft: 36,
  fx: {axis: null, padding: 0.12}, fy: {axis: null, padding: 0.2},
  x: {label: null, type: "utc", ticks: [year(2010), year(2020)], tickFormat: "%Y"},
  y: {label: null, grid: true, ticks: [90, 100, 110, 120, 130]},
  marks: [
    Plot.lineY(order.flatMap((region) => quebecSeries.map((d) => ({...d, region, ...cell(region)}))), {x: (d) => year(d.year), y: "index", fx: "fx", fy: "fy", z: "region", stroke: "var(--theme-foreground-faint)"}),
    Plot.ruleY([100], {stroke: "var(--theme-foreground-faintest)"}),
    Plot.lineY(regionSeries, {x: (d) => year(d.year), y: "index", fx: (d) => cell(d.region).fx, fy: (d) => cell(d.region).fy,
      stroke: (d) => (d.index >= 100 ? "var(--theme-foreground-focus)" : "var(--theme-red)"), z: "region", strokeWidth: 2,
      tip: {channels: {region: "region", population: {value: (d) => number(d.population), label: "Population"}}, format: {x: "%Y", fx: false, fy: false, stroke: false, y: (d) => d.toFixed(0)}}}),
    Plot.text(order, {fx: (r) => cell(r).fx, fy: (r) => cell(r).fy, frameAnchor: "top-left", dx: 3, dy: 3, text: (r) => (r.length > 17 ? r.slice(0, 16) + "…" : r), fontWeight: 600})
  ]
})));
```

### Biggest changes in ten years

Municipalities of at least 5,000 residents with the strongest growth or decline between 2016 and ${latest}.
Each arrow goes from the 2016 population to today's.

```js
const changes = municipalities.filter((d) => d.population >= 5000 && d.population_2016 > 0).map((d) => ({...d, change: d.population / d.population_2016 - 1}));
const movers = [...d3.sort(changes, (d) => -d.change).slice(0, 12), ...d3.sort(changes, (d) => d.change).slice(0, 5)];
display(Plot.plot({
  marginLeft: 250, marginRight: 60, height: 40 + 22 * movers.length,
  x: {type: "log", label: "Population", grid: true, ticks: [5000, 10000, 20000, 50000, 100000], tickFormat: number},
  y: {label: null, domain: d3.sort(movers, (d) => -d.change).map((d) => d.name)},
  color: {type: "categorical", domain: [true, false], range: ["var(--theme-foreground-focus)", "var(--theme-red)"]},
  marks: [
    Plot.arrow(movers, {x1: "population_2016", x2: "population", y: "name", stroke: (d) => d.change >= 0, strokeWidth: 2, headLength: 6,
      channels: {"2016": {value: (d) => number(d.population_2016)}, [latest]: {value: (d) => number(d.population)}}, tip: {format: {x1: false, x2: false, stroke: false}}}),
    Plot.text(movers, {x: (d) => Math.max(d.population, d.population_2016), y: "name", text: (d) => (d.change >= 0 ? "+" : "") + pct(d.change), dx: 6, textAnchor: "start"})
  ]
}));
```

## When were they constituted?

Constitution dates by decade. The 1845–1855 wave is the birth of the parish and township municipalities of
Lower Canada; the large *villes* of today date from the 2002 mergers.

```js
Plot.plot({
  height: 260,
  x: {label: null, type: "utc"},
  y: {label: "Municipalities", grid: true},
  color: {...kindColor, legend: true},
  marks: [
    Plot.rectY(municipalities.filter((d) => d.founded), Plot.binX({y: "count"}, {x: "founded", fill: "kind", interval: d3.utcYear.every(10), insetLeft: 0.5, insetRight: 0.5,
      tip: {format: {fill: (k) => kindName(k)}}})),
    Plot.ruleY([0])
  ]
})
```

## Saints and demonyms

<div class="grid grid-cols-2">
<div>

```js
const saintNames = d3.rollups(saints, (v) => v.length, (d) => d.name.match(/^Sainte?-([^-]+)/)[0]).map(([saint, n]) => ({saint, n}));
display(resize((width) => Plot.plot({
  width, title: "The most popular saints", marginLeft: 120, height: 360,
  x: {label: "Municipalities", grid: true},
  y: {label: null},
  marks: [Plot.barX(saintNames, {x: "n", y: "saint", sort: {y: "-x", limit: 15}, fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
})));
```

</div>
<div>

```js
const endings = ["ois", "ais", "ien", "éen", "ain", "in", "ard", "ier", "on", "an"];
const demonyms = municipalities.filter((d) => d.demonym).map((d) => {
  const masculine = d.demonym.split(",")[0].replace("*", "").trim();
  return {name: d.name, masculine, ending: "-" + (endings.find((e) => masculine.endsWith(e)) ?? "…")};
});
display(resize((width) => Plot.plot({
  width, title: "Demonym endings (gentilés)", marginLeft: 60, height: 360,
  x: {label: "Municipalities", grid: true},
  y: {label: null},
  marks: [
    Plot.barX(demonyms, Plot.groupY({x: "count", title: (v) => v.slice(0, 4).map((d) => `${d.masculine} (${d.name})`).join("\n")},
      {y: "ending", sort: {y: "-x"}, fill: "var(--theme-foreground-focus)", tip: true})),
    Plot.ruleX([0])
  ]
})));
```

</div>
</div>

<p class="muted">${number(demonyms.length)} municipalities have an official demonym: Lavallois, Montréalais, Trifluvien, Sherbrookois, Gaspésien…</p>

## Query the municipalities in SuperSQL (wasm engine)

The same `municipalities.bsup` file, loaded into the SuperDB engine running in this page.

```js
import {SuperDBClient} from "./components/superdb-client.js";
const db = await SuperDBClient.of({municipalities: FileAttachment("data/quebec/municipalities.bsup")});
const examples = {
  "Population by MRC": "from municipalities\n| where mrc is not null\n| aggregate population:=sum(population), n:=count() by mrc, region\n| sort -r population\n| limit 15",
  "Saint- or Sainte-": "from municipalities\n| where grep('^Saint', name)\n| aggregate n:=count(), population:=sum(population) by saint:=grep('^Sainte-', name) ? 'Sainte-' : 'Saint-'",
  "SQL: density by region": "select region, count(*) as n, sum(population) as population,\n  round(sum(population)/sum(land)) as density\nfrom municipalities\ngroup by region\norder by density desc"
};
const example = view(Inputs.select(Object.keys(examples), {label: "Example"}));
```

```js
const query = view(Inputs.textarea({value: examples[example], rows: 6, width: "100%", submit: "Run (⌘↩)", monospace: true, spellcheck: false}));
```

```js
const result = await db.query(query).then((rows) => ({rows, ms: db.lastMs}), (error) => ({error}));
display(result.error
  ? html`<pre class="error">${result.error.message}</pre>`
  : html`<p class="muted">${number(result.rows.length)} rows — ${result.ms.toFixed(0)} ms in the engine</p>${Inputs.table(result.rows, {rows: 10})}`);
```

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
pre.error { color: var(--theme-red); white-space: pre-wrap; }
</style>

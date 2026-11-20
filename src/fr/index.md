---
title: Démo BSUP
toc: {label: "Sommaire"}
---

# SuperDB dans Observable Framework

Les fichiers `.bsup` sont produits **au build** par des data loaders (`src/data/*.bsup.sh`)
qui exécutent `super`, puis décodés dans le navigateur par
[super-ts](https://github.com/superdb/super-ts) (19 ko gzip).

```js
import {loadBSUP, typesOf, sup} from "../components/superdb.js";
const ventes = await loadBSUP(FileAttachment("../data/sales.bsup"));
const evenements = await loadBSUP(FileAttachment("../data/events.bsup"));
```

## Ventes — ${ventes.length.toLocaleString("fr-CA")} lignes

```js
Plot.plot({
  marginLeft: 110,
  x: {label: "Montant total ($)", grid: true},
  marks: [Plot.barX(ventes, Plot.groupY({x: "sum"}, {x: "amount", y: "region", sort: {y: "-x"}, tip: true}))]
})
```

```js
Plot.plot({
  marginLeft: 80,
  y: {label: "Ventes / mois ($)", grid: true},
  marks: [Plot.rectY(ventes, Plot.binX({y: "sum"}, {x: "date", y: "amount", interval: "month", fill: "region", tip: true}))],
  color: {legend: true}
})
```

```js
Inputs.table(ventes)
```

## Événements hétérogènes — ${evenements.length.toLocaleString("fr-CA")} valeurs

BSUP conserve **chaque forme** telle quelle : pas de schéma imposé, pas de colonnes nulles,
et `code` reste un entier *ou* une chaîne.

```js
Inputs.table(typesOf(evenements), {width: {count: 80}})
```

```js
Plot.plot({
  marginLeft: 60,
  marks: [Plot.barX(evenements, Plot.groupY({x: "count"}, {y: "kind", sort: {y: "-x"}, tip: true}))]
})
```

Quelques valeurs en SUP (identique à `super -s`) :

```js
html`<pre>${[0, 1, 2, 3, 4].map((i) => sup(evenements, i)).join("\n")}</pre>`
```

```js
Inputs.table(evenements.filter((d) => d.kind === "error"))
```

---
title: GitHub Archive (GHA)
toc: {label: "Sommaire"}
---

# GitHub Archive : l'échantillon « GHA Sample »

L'échantillon d'événements [GitHub Archive](https://www.gharchive.org/) qu'utilise l'équipe SuperDB
pour ses bancs d'essai (issues [#7503](https://github.com/superdb/super/issues/7503),
[#7070](https://github.com/superdb/super/issues/7070), [#7152](https://github.com/superdb/super/issues/7152),
tutoriel [performance](https://superdb.org/tutorials/performance.html)) : des événements GitHub du
8 février 2023, en JSON. Ce sont des données imbriquées, irrégulières, où les champs vont et viennent :
c'est ce qui en fait le « test acide » d'un moteur de requêtes.

```js
import {loadBSUP} from "../components/superdb.js";
import {i18n} from "../components/i18n.js";
const formes = await loadBSUP(FileAttachment("../data/gha/shapes.bsup"));
const tailles = await loadBSUP(FileAttachment("../data/gha/sizes.bsup"));
const banc = await loadBSUP(FileAttachment("../data/gha/bench.bsup"));
const evenements = await loadBSUP(FileAttachment("../data/gha/events.bsup"));
```

```js
const {number: nombre, mb: mo, fileLabel} = i18n("fr");
const total = d3.sum(formes, (d) => d.n);
const totalFormes = d3.sum(formes, (d) => d.shapes);
const taille = (format, variant = null) => tailles.find((d) => d.format === format && d.variant === variant).bytes;
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Événements</h2><span class="big">${nombre(total)}</span><br>${formes.length} types d'événement</div>
  <div class="card"><h2>Formes distinctes</h2><span class="big">${nombre(totalFormes)}</span><br>une par événement</div>
  <div class="card"><h2>BSUP</h2><span class="big">${mo(taille("bsup"))}</span><br>aucun schéma à imposer</div>
  <div class="card"><h2>Parquet</h2><span class="big">${mo(taille("parquet", "fused"))}</span><br>après <code>fuse</code> en un seul schéma</div>
</div>

## Pourquoi c'est difficile : une forme par événement

Chaque événement de l'échantillon a un type (une « forme ») différent de tous les autres : un champ
`org` présent ou non, un `milestone` nul ou rempli, des listes vides ou pas… Même à l'intérieur d'un
seul type d'événement, le `payload` change presque à chaque ligne. Une base relationnelle doit tout
fusionner en un schéma unique et clairsemé ; SuperDB garde chaque valeur avec son type exact.

```js
Plot.plot({
  marginLeft: 210, height: 420,
  x: {type: "log", label: "Nombre (échelle log)", grid: true, tickFormat: "~s"},
  y: {axis: null, domain: ["événements", "formes du payload"]},
  fy: {label: null, axis: "left", domain: formes.map((d) => d.type)},
  color: {legend: true, domain: ["événements", "formes du payload"]},
  marks: [
    Plot.barX(formes.flatMap((d) => [{type: d.type, mesure: "événements", n: d.n}, {type: d.type, mesure: "formes du payload", n: d.payload_shapes}]),
      {x1: 0.8, x2: "n", y: "mesure", fy: "type", fill: "mesure", tip: {channels: {n: "n"}}})
  ]
})
```

<p class="muted">L'égalité exacte « événements = formes » pour chaque type laisse penser que l'échantillon a été
construit en gardant un événement par forme distincte de la journée. La répartition par type n'est donc pas
représentative de l'activité réelle de GitHub (les pull requests y dominent).</p>

## Le même échantillon dans trois formats

```js
Plot.plot({
  marginLeft: 150, marginRight: 70, height: 170,
  x: {label: "Taille (Mo)", grid: true, transform: (d) => d / 1e6},
  y: {label: null, domain: tailles.map(fileLabel)},
  marks: [
    Plot.barX(tailles, {x: "bytes", y: fileLabel, fill: "var(--theme-foreground-focus)", tip: {format: {x: (d) => mo(d * 1e6)}}}),
    Plot.text(tailles, {x: "bytes", y: fileLabel, text: (d) => mo(d.bytes), dx: 4, textAnchor: "start"}),
    Plot.ruleX([0])
  ]
})
```

<p class="muted">Parquet exige de fusionner ces milliers de formes en un seul schéma très large et presque vide,
d'où sa taille. La projection BSUP (${mo(taille("bsup", "projection"))}) est ce que le navigateur charge plus bas.</p>

## Les cinq requêtes du banc d'essai

Les requêtes du tutoriel [performance](https://superdb.org/tutorials/performance.html), exécutées au build
par `super` (${banc[0].version}) sur l'échantillon complet, meilleur de trois essais.
*search+* utilise `grep('…', this)` : sur main, `grep` exige maintenant deux arguments.

```js
Plot.plot({
  marginLeft: 70, height: 230,
  x: {label: "Durée (ms)", grid: true},
  y: {label: null, axis: null},
  fy: {label: null, axis: "left", domain: ["search", "search+", "count", "agg", "union"]},
  color: {legend: true, domain: ["bsup", "parquet"]},
  marks: [
    Plot.barX(banc, {x: "ms", y: "format", fy: "test", fill: "format", tip: true}),
    Plot.ruleX([0])
  ]
})
```

```js
const test = view(Inputs.select(["search", "search+", "count", "agg", "union"], {label: "Requête", value: "union"}));
```

```js
const ligne = banc.find((d) => d.test === test && d.format === "bsup");
display(html`<pre>${ligne.query}</pre><p>Résultat (identique en Parquet) :</p><pre>${ligne.result || "(aucune ligne : ce dépôt n'est pas dans l'échantillon)"}</pre>`);
```

## Activité de la journée

Une projection d'une ligne par événement (acteur, dépôt, titre, langage, étiquettes, assignés…),
calculée au build avec `coalesce` sur les champs qui n'existent que pour certains types.

```js
const principaux = formes.slice(0, 5).map((d) => d.type);
const typeAffiche = (d) => principaux.includes(d.type) ? d.type : "autres";
display(Plot.plot({
  height: 260,
  x: {label: "Heure (UTC)", type: "utc", tickFormat: "%H h"},
  y: {label: "Événements par heure", grid: true},
  color: {legend: true, domain: [...principaux, "autres"]},
  marks: [
    Plot.rectY(evenements, Plot.binX({y: "count"}, {x: "ts", interval: "hour", fill: typeAffiche, tip: true})),
    Plot.ruleY([0])
  ]
}));
```

<div class="grid grid-cols-2">
<div>

```js
const langages = d3.rollups(evenements.filter((d) => d.language), (v) => v.length, (d) => d.language)
  .map(([langage, n]) => ({langage, n})).sort((a, b) => b.n - a.n).slice(0, 12);
display(resize((width) => Plot.plot({
  width, title: "Langage du dépôt (pull requests et revues)",
  marginLeft: 90, height: 300,
  x: {label: "Événements", grid: true},
  y: {label: null, domain: langages.map((d) => d.langage)},
  marks: [Plot.barX(langages, {x: "n", y: "langage", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
})));
```

</div>
<div>

```js
const revues = d3.rollups(evenements.filter((d) => d.review), (v) => v.length, (d) => d.review)
  .map(([revue, n]) => ({revue, n})).sort((a, b) => b.n - a.n);
display(resize((width) => Plot.plot({
  width, title: "État des revues de code",
  marginLeft: 130, height: 300,
  x: {label: "Revues", grid: true},
  y: {label: null, domain: revues.map((d) => d.revue)},
  marks: [Plot.barX(revues, {x: "n", y: "revue", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
})));
```

</div>
</div>

## Explorer dans le navigateur (moteur wasm)

La projection est chargée dans le moteur SuperDB qui tourne dans la page ; chaque recherche est une
requête SuperSQL.

```js
import {SuperDBClient, literal} from "../components/superdb-client.js";
const db = await SuperDBClient.of({gha: FileAttachment("../data/gha/events.bsup")});
const langagesTous = (await db.sql`from gha | where language is not null | aggregate n:=count() by language | sort -r n`).map((d) => d.language);
```

```js
const filtres = view(Inputs.form({
  texte: Inputs.text({label: "Recherche (titre, étiquettes)", placeholder: "ex. bump, security, rust…"}),
  langage: Inputs.select([null, ...langagesTous], {label: "Langage", format: (d) => d ?? "(tous)"}),
  type: Inputs.select([null, ...formes.map((d) => d.type)], {label: "Type", format: (d) => d ?? "(tous)"})
}));
```

```js
const conditions = ["true"];
if (filtres.texte) conditions.push(`grep(${literal(filtres.texte)}, {title, labels})`);
if (filtres.langage) conditions.push(`language = ${literal(filtres.langage)}`);
if (filtres.type) conditions.push(`type = ${literal(filtres.type)}`);
const ou = conditions.join(" and ");
const resume = await db.query(`from gha | where ${ou} | aggregate n:=count(), repos:=count(distinct repo), actors:=count(distinct actor)`);
const resumeMs = db.lastMs;
const assignes = await db.query(`from gha | where ${ou} | unnest assignees | aggregate n:=count() by assignee:=this | sort -r n, assignee | limit 10`);
const trouves = await db.query(`from gha | where ${ou} | sort -r ts | limit 500 | values {ts, type, actor, repo, title, language, labels}`);
```

<p>${nombre(resume[0].n)} événements, ${nombre(resume[0].repos)} dépôts, ${nombre(resume[0].actors)} acteurs
<span class="muted">— requête en ${resumeMs.toFixed(0)} ms dans le moteur</span></p>

<pre class="muted">from gha${conditions.length > 1 ? ` | where ${conditions.slice(1).join(" and ")}` : ""}</pre>

```js
assignes.length
  ? Plot.plot({
      title: "Assignés les plus fréquents",
      marginLeft: 130, height: 40 + 22 * assignes.length,
      x: {label: "Assignations", grid: true},
      y: {label: null, domain: assignes.map((d) => d.assignee)},
      marks: [Plot.barX(assignes, {x: "n", y: "assignee", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
    })
  : html`<p class="muted">Aucun assigné pour ces filtres.</p>`
```

```js
Inputs.table(trouves, {
  rows: 12,
  columns: ["ts", "type", "repo", "title", "language"],
  format: {ts: (d) => d.toISOString().slice(11, 19), type: (d) => d.replace(/Event$/, "")},
  header: {ts: "heure (UTC)", repo: "dépôt", title: "titre", language: "langage"},
  layout: "auto"
})
```

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
</style>

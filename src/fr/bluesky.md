---
title: Bluesky (JSONBench)
toc: {label: "Sommaire"}
---

# Bluesky : un million d'événements du « firehose »

Le premier fichier du banc d'essai [JSONBench](https://github.com/ClickHouse/JSONBench) : un million
d'événements bruts du réseau Bluesky (13 minutes et demie, le 21 novembre 2024), en JSON. C'est le jeu
qu'utilise l'équipe SuperDB dans les issues [#7484](https://github.com/superdb/super/issues/7484) et
[#7480](https://github.com/superdb/super/issues/7480). Il est beaucoup plus homogène que GHA : l'enveloppe
des événements est toujours la même, et l'irrégularité se concentre dans le contenu des posts.

```js
import {loadBSUP} from "../components/superdb.js";
import {i18n} from "../components/i18n.js";
const collections = await loadBSUP(FileAttachment("../data/bluesky/collections.bsup"));
const flux = await loadBSUP(FileAttachment("../data/bluesky/flow.bsup"));
const formesPosts = await loadBSUP(FileAttachment("../data/bluesky/shapes.bsup"));
const tailles = await loadBSUP(FileAttachment("../data/bluesky/sizes.bsup"));
const banc = await loadBSUP(FileAttachment("../data/bluesky/bench.bsup"));
const profil = (await loadBSUP(FileAttachment("../data/comparison/profiles.bsup"))).find((d) => d.dataset === "bluesky");
```

```js
const {number: nombre, mb: mo, pct, fileLabel} = i18n("fr");
const court = (c) => c.replace(/^app\.bsky\./, "");
const total = d3.sum(collections, (d) => d.n);
const taille = (format, variant) => tailles.find((d) => d.format === format && d.variant === variant).bytes;
const posts = collections.find((d) => d.collection === "app.bsky.feed.post");
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Événements</h2><span class="big">${nombre(total)}</span><br>${collections.length} collections</div>
  <div class="card"><h2>Formes distinctes</h2><span class="big">${nombre(profil.shapes)}</span><br>dont ${formesPosts.length} pour les posts créés</div>
  <div class="card"><h2>JSON (gzip)</h2><span class="big">${mo(taille("json.gz", null))}</span><br>fichier d'origine</div>
  <div class="card"><h2>BSUP</h2><span class="big">${mo(taille("bsup", "full"))}</span><br>tous les champs, types exacts</div>
</div>

## Peu de collections, beaucoup de volume

Les « j'aime » et les abonnements font 80 % du trafic et n'ont que deux ou trois formes. Les posts sont
dix fois moins nombreux mais portent presque toutes les formes : réponses, images, liens, citations, vidéos…

```js
const ordre = collections.map((d) => court(d.collection));
```

<div class="grid grid-cols-2">
<div>

```js
display(resize((width) => Plot.plot({
  width, title: "Événements par collection", marginLeft: 150, height: 380,
  x: {type: "log", label: "Événements (échelle log)", grid: true, tickFormat: "~s"},
  y: {label: null, domain: ordre},
  marks: [Plot.barX(collections, {x1: 1, x2: "n", y: (d) => court(d.collection), fill: "var(--theme-foreground-focus)", tip: {channels: {n: "n"}}})]
})));
```

</div>
<div>

```js
display(resize((width) => Plot.plot({
  width, title: "Formes distinctes par collection", marginLeft: 150, height: 380,
  x: {label: "Formes", grid: true},
  y: {label: null, domain: ordre},
  marks: [Plot.barX(collections, {x: "shapes", y: (d) => court(d.collection), fill: "var(--theme-foreground-focus)", tip: {channels: {formes: "shapes"}, format: {x: false}}}), Plot.ruleX([0])]
})));
```

</div>
</div>

## Le flux, seconde par seconde

```js
const principales = collections.slice(0, 4).map((d) => d.collection);
const groupe = (c) => (principales.includes(c) ? court(c) : "autres");
const fluxGroupe = d3.rollups(flux, (v) => d3.sum(v, (d) => d.n), (d) => +d.t, (d) => groupe(d.collection))
  .flatMap(([t, g]) => g.map(([collection, n]) => ({t: new Date(t), collection, parSeconde: n / 10})));
display(Plot.plot({
  height: 260,
  x: {label: null, type: "utc", tickFormat: "%H:%M"},
  y: {label: "Événements par seconde (moyenne sur 10 s)", grid: true},
  color: {legend: true, domain: [...principales.map(court), "autres"]},
  marks: [Plot.areaY(fluxGroupe, {x: "t", y: "parSeconde", fill: "collection", order: [...principales.map(court), "autres"], tip: true}), Plot.ruleY([0])]
}));
```

## Les ${nombre(formesPosts.length)} formes d'un post

```js
const totalPosts = d3.sum(formesPosts, (d) => d.n);
const top = formesPosts.slice(0, 20).map((d, i) => ({...d, rang: i + 1, part: d.n / totalPosts}));
const couverture = (k) => d3.sum(formesPosts.slice(0, k), (d) => d.n) / totalPosts;
```

Les 5 formes les plus courantes couvrent ${pct(couverture(5))} des posts, les 20 premières ${pct(couverture(20))} ;
les ${nombre(formesPosts.length - 20)} autres se partagent le reste. Survolez une barre pour voir les champs de la forme.

```js
Plot.plot({
  marginLeft: 40, height: 420,
  x: {label: "Posts", grid: true},
  y: {label: "Rang", domain: top.map((d) => d.rang)},
  marks: [
    Plot.barX(top, {x: "n", y: "rang", fill: "var(--theme-foreground-focus)",
      tip: {format: {y: false}, channels: {part: {value: (d) => pct(d.part), label: "part"}, champs: {value: (d) => d.fields.join("\n"), label: "champs"}}}}),
    Plot.ruleX([0])
  ]
})
```

## Les cinq requêtes de JSONBench

Exécutées au build par `super` (${banc[0].version}), meilleur de trois essais, sur trois fichiers :
le BSUP complet, et une version sans `commit.record` en BSUP et en Parquet. Le Parquet du fichier complet
est impossible : `fuse` produit un type qui contient des records vides, que Parquet refuse
(*unsupported type: empty record*).

```js
const series = [...new Set(banc.map(fileLabel))];
display(Plot.plot({
  marginLeft: 40, height: 300,
  x: {label: "Durée (ms)", grid: true},
  y: {label: null, axis: null, domain: series},
  fy: {label: null, axis: "left", domain: ["q1", "q2", "q3", "q4", "q5"]},
  color: {legend: true, domain: series},
  marks: [Plot.barX(banc, {x: "ms", y: fileLabel, fy: "test", fill: fileLabel, tip: true}), Plot.ruleX([0])]
}));
```

```js
const q = view(Inputs.select(["q1", "q2", "q3", "q4", "q5"], {label: "Requête", value: "q2"}));
```

```js
const ligne = banc.find((d) => d.test === q && d.variant === "full");
display(html`<pre>${ligne.query}</pre><p>Résultat (identique sur les trois fichiers) :</p><pre>${ligne.result}</pre>`);
```

<p class="muted">Le fichier ne couvre qu'une partie de l'heure de 16 h (UTC) : q3 n'a donc qu'une heure.
Les requêtes de JSONBench sont adaptées : <code>date_part('hour', (time_us*1000)::timestamp)</code>
remplace <code>EXTRACT(HOUR FROM …::time)</code> (le type <code>time</code> n'existe plus sur main).</p>

## Explorer les posts dans le navigateur (moteur wasm)

Les ${nombre(posts.creates)} posts créés, réduits à quelques champs au build, sont chargés dans le moteur
SuperDB qui tourne dans la page ; chaque recherche est une requête SuperSQL.

```js
import {SuperDBClient, literal} from "../components/superdb-client.js";
const db = await SuperDBClient.of({posts: FileAttachment("../data/bluesky/posts.bsup")});
const langues = (await db.sql`from posts | where lang is not null | aggregate n:=count() by lang | sort -r n | limit 30`).map((d) => d.lang);
const medias = (await db.sql`from posts | aggregate n:=count() by media | sort -r n`).map((d) => d.media);
const nomsMedias = {none: "aucun", images: "images", external: "lien", record: "citation", recordWithMedia: "citation + média", video: "vidéo"};
const nomMedia = (m) => nomsMedias[m.replace(/^app\.bsky\.embed\./, "")] ?? m;
```

```js
const filtres = view(Inputs.form({
  texte: Inputs.text({label: "Recherche dans le texte", placeholder: "ex. bluesky, twitter, café…"}),
  langue: Inputs.select([null, ...langues], {label: "Langue", format: (d) => d ?? "(toutes)"}),
  media: Inputs.select([null, ...medias], {label: "Média joint", format: (d) => (d === null ? "(tous)" : nomMedia(d))}),
  reponse: Inputs.select([null, true, false], {label: "Réponse", format: (d) => (d === null ? "(toutes)" : d ? "oui" : "non")})
}));
```

```js
const conditions = [];
if (filtres.texte) conditions.push(`grep(${literal(filtres.texte)}, text)`);
if (filtres.langue) conditions.push(`lang = ${literal(filtres.langue)}`);
if (filtres.media) conditions.push(`media = ${literal(filtres.media)}`);
if (filtres.reponse !== null) conditions.push(`reply = ${filtres.reponse}`);
const ou = conditions.length ? ` | where ${conditions.join(" and ")}` : "";
const resume = await db.query(`from posts${ou} | aggregate n:=count(), authors:=count(distinct author), replies:=count() filter (reply), length:=avg(length)`);
const resumeMs = db.lastMs;
const parTranche = await db.query(`from posts${ou} | aggregate n:=count() by t:=bucket(ts, 30s) | sort t`);
const trouves = await db.query(`from posts${ou} | sort -r ts | limit 500 | values {ts, lang, media, text}`);
```

<p>${nombre(resume[0].n)} posts, ${nombre(resume[0].authors)} auteurs,
${resume[0].n ? pct(resume[0].replies / resume[0].n) : "—"} de réponses,
${resume[0].n ? Math.round(resume[0].length) : "—"} caractères en moyenne
<span class="muted">— requête en ${resumeMs.toFixed(0)} ms dans le moteur</span></p>

<pre class="muted">from posts${ou}</pre>

```js
Plot.plot({
  height: 180,
  x: {label: null, type: "utc", tickFormat: "%H:%M"},
  y: {label: "Posts par 30 s", grid: true},
  marks: [Plot.rectY(parTranche, {x1: "t", x2: (d) => new Date(+d.t + 30e3), y: "n", fill: "var(--theme-foreground-focus)", inset: 0.5, tip: true}), Plot.ruleY([0])]
})
```

```js
Inputs.table(trouves, {
  rows: 12,
  format: {ts: (d) => d.toISOString().slice(11, 19), media: nomMedia},
  header: {ts: "heure (UTC)", lang: "langue", media: "média", text: "texte"},
  width: {ts: 90, lang: 70, media: 110},
  layout: "auto"
})
```

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
</style>

---
title: ClickBench (hits_0)
toc: {label: "Sommaire"}
---

# ClickBench : un million de visites web, une seule forme

Le premier des 100 fichiers de la table `hits` de [ClickBench](https://github.com/ClickHouse/ClickBench) :
un million de pages vues anonymisées de Yandex.Metrica, sur une seule journée (le 15 juillet 2013, heure de Moscou).
C'est l'opposé de GHA : une table plate de 105 colonnes où chaque ligne a exactement le même type.
C'est le terrain de Parquet, et la référence des bases analytiques.

```js
import {loadBSUP} from "../components/superdb.js";
import {i18n} from "../components/i18n.js";
const colonnes = await loadBSUP(FileAttachment("../data/clickbench/columns.bsup"));
const trafic = await loadBSUP(FileAttachment("../data/clickbench/traffic.bsup"));
const tailles = await loadBSUP(FileAttachment("../data/clickbench/sizes.bsup"));
const banc = await loadBSUP(FileAttachment("../data/clickbench/bench.bsup"));
const profil = (await loadBSUP(FileAttachment("../data/comparison/profiles.bsup"))).find((d) => d.dataset === "clickbench");
```

```js
const {number: nombre, mb: mo, fileLabel: etiquette} = i18n("fr");
const nomType = (t) => t.replace(/^<|>$/g, "");
const types = ["int16", "int32", "int64", "uint16", "string"];
const vides = colonnes.filter((d) => !d.filled);
const taille = (format, variant = null) => tailles.find((d) => d.format === format && (d.variant ?? null) === variant).bytes;
```

<div class="grid grid-cols-4">
  <div class="card"><h2>Visites</h2><span class="big">${nombre(profil.rows)}</span><br>une journée de trafic</div>
  <div class="card"><h2>Formes distinctes</h2><span class="big">${nombre(profil.shapes)}</span><br>${colonnes.length} colonnes, toutes plates</div>
  <div class="card"><h2>Colonnes vides</h2><span class="big">${vides.length}</span><br>que des 0 ou "" sur toutes les lignes</div>
  <div class="card"><h2>BSUP</h2><span class="big">${mo(taille("bsup"))}</span><br>contre ${mo(taille("parquet", "clickhouse"))} pour le Parquet de ClickHouse</div>
</div>

## 105 colonnes, dont beaucoup presque vides

Chaque barre est une colonne, triée selon la part des lignes qui contiennent autre chose que `0` ou `""`.
La table est large mais clairsemée : un format en colonnes compresse ces colonnes constantes presque à néant.

```js
display(Plot.plot({
  height: 260, marginBottom: 20,
  x: {label: null, axis: null, domain: colonnes.map((d) => d.column)},
  y: {label: "Lignes avec une valeur", grid: true, percent: true},
  color: {legend: true, domain: types},
  marks: [
    Plot.barY(colonnes, {x: "column", y: (d) => (d.filled ?? 0) / profil.rows, fill: (d) => nomType(d.type), inset: 0.5,
      tip: {channels: {colonne: "column", lignes: {value: (d) => nombre(d.filled ?? 0), label: "lignes"}}, format: {x: false}}}),
    Plot.ruleY([0])
  ]
}));
```

<p class="muted">Colonnes vides : ${vides.map((d) => d.column).sort().join(", ")}.
${colonnes.filter((d) => nomType(d.type) === "string").length} colonnes sont des chaînes : dans le fichier Parquet d'origine,
elles sont stockées en <code>bytes</code>, ce qui compte plus bas.</p>

## Le trafic de la journée

```js
Plot.plot({
  height: 240,
  x: {label: "Heure de Moscou", type: "utc", tickFormat: "%H h"},
  y: {label: "Visites par 10 minutes", grid: true, tickFormat: "~s"},
  color: {legend: true, domain: ["ordinateur", "mobile"]},
  marks: [Plot.areaY(trafic, {x: "t", y: "n", fill: (d) => (d.mobile ? "mobile" : "ordinateur"), order: ["ordinateur", "mobile"], tip: true}), Plot.ruleY([0])]
})
```

## La même table dans trois fichiers

```js
Plot.plot({
  marginLeft: 200, marginRight: 70, height: 120,
  x: {label: "Taille (Mo)", grid: true, transform: (d) => d / 1e6},
  y: {label: null, domain: tailles.map(etiquette)},
  marks: [
    Plot.barX(tailles, {x: "bytes", y: etiquette, fill: "var(--theme-foreground-focus)", tip: {format: {x: (d) => mo(d * 1e6)}}}),
    Plot.text(tailles, {x: "bytes", y: etiquette, text: (d) => mo(d.bytes), dx: 4, textAnchor: "start"}),
    Plot.ruleX([0])
  ]
})
```

<p class="muted">Le BSUP et le Parquet « écrit par super » viennent d'une conversion typée du fichier d'origine
(<code>queries/hits-cast.spq</code> : <code>bytes</code> → <code>string</code>, sans unions avec <code>null</code>).
Le fichier de ClickHouse est le plus compact.</p>

## Sept requêtes de ClickBench

Un échantillon des 43 requêtes de ClickBench (numérotation d'origine), exécutées au build par `super`
(${banc[0].version}), meilleur de trois essais. Une barre vide signale un résultat différent de celui du BSUP.

```js
const tests = [...new Set(banc.map((d) => d.test))];
const series = [...new Set(banc.map(etiquette))];
const reference = new Map(banc.filter((d) => d.format === "bsup").map((d) => [d.test, d.result]));
const identique = (d) => d.result === reference.get(d.test);
display(Plot.plot({
  marginLeft: 50, height: 340,
  x: {label: "Durée (ms)", grid: true},
  y: {label: null, axis: null, domain: series},
  fy: {label: null, axis: "left", domain: tests},
  color: {legend: true, domain: series},
  marks: [
    Plot.barX(banc.filter(identique), {x: "ms", y: etiquette, fy: "test", fill: etiquette, tip: true}),
    Plot.barX(banc.filter((d) => !identique(d)), {x: "ms", y: etiquette, fy: "test", fill: "none", stroke: etiquette, strokeWidth: 1.5, inset: 1,
      tip: {channels: {résultat: {value: () => "différent", label: "résultat"}}}}),
    Plot.ruleX([0])
  ]
}));
```

```js
const q = view(Inputs.select(tests, {label: "Requête", value: "Q33"}));
```

```js
const lignes = banc.filter((d) => d.test === q);
display(html`<pre>${lignes[0].query}</pre>
<div class="grid grid-cols-3">${lignes.map((d) => html`<div><b>${etiquette(d)}</b> — ${d.ms} ms
${identique(d) ? "" : html` <span class="different">résultat différent</span>`}<pre class="result">${d.result || "(aucune ligne)"}</pre></div>`)}</div>`);
```

<p class="muted">Dans le Parquet de ClickHouse, les chaînes sont des <code>bytes</code> non typés : Q12 ne trouve
aucune phrase de recherche, Q20 aucune URL contenant « google », et Q33 renvoie des URL en hexadécimal. Ses durées
ne sont donc pas comparables pour ces requêtes.</p>

## Explorer les recherches dans le navigateur (moteur wasm)

Les ${nombre(total)} visites qui portent une phrase de recherche, réduites à quelques champs au build, sont chargées
dans le moteur SuperDB qui tourne dans la page. Les phrases sont en russe.

```js
import {SuperDBClient, literal} from "../components/superdb-client.js";
const db = await SuperDBClient.of({searches: FileAttachment("../data/clickbench/searches.bsup")});
const total = (await db.sql`from searches | aggregate n:=count()`)[0].n;
```

```js
const filtres = view(Inputs.form({
  texte: Inputs.text({label: "Recherche dans les phrases", placeholder: "ex. фильм, рецепт, москва…"}),
  mobile: Inputs.select([null, false, true], {label: "Appareil", format: (d) => (d === null ? "(tous)" : d ? "mobile" : "ordinateur")})
}));
```

```js
const conditions = [];
if (filtres.texte) conditions.push(`grep(${literal(filtres.texte)}, phrase)`);
if (filtres.mobile !== null) conditions.push(`mobile = ${filtres.mobile}`);
const ou = conditions.length ? ` | where ${conditions.join(" and ")}` : "";
const resume = await db.query(`from searches${ou} | aggregate n:=count(), phrases:=count(distinct phrase), users:=count(distinct user), regions:=count(distinct region)`);
const resumeMs = db.lastMs;
const topPhrases = await db.query(`from searches${ou} | aggregate n:=count() by phrase | sort -r n, phrase | limit 12`);
const parHeure = await db.query(`from searches${ou} | aggregate n:=count() by t:=bucket(ts, 1h) | sort t`);
```

<p>${nombre(resume[0].n)} recherches sur ${nombre(total)}, ${nombre(resume[0].phrases)} phrases distinctes,
${nombre(resume[0].users)} utilisateurs, ${nombre(resume[0].regions)} régions
<span class="muted">— requête en ${resumeMs.toFixed(0)} ms dans le moteur</span></p>

<pre class="muted">from searches${ou}</pre>

<div class="grid grid-cols-2">
<div>

```js
display(resize((width) => topPhrases.length
  ? Plot.plot({
      width, title: "Phrases les plus fréquentes", marginLeft: 230, height: 40 + 22 * topPhrases.length,
      x: {label: "Recherches", grid: true},
      y: {label: null, domain: topPhrases.map((d) => d.phrase), tickFormat: (d) => (d.length > 34 ? d.slice(0, 33) + "…" : d)},
      marks: [Plot.barX(topPhrases, {x: "n", y: "phrase", fill: "var(--theme-foreground-focus)", tip: true}), Plot.ruleX([0])]
    })
  : html`<p class="muted">Aucune recherche pour ces filtres.</p>`));
```

</div>
<div>

```js
display(resize((width) => Plot.plot({
  width, title: "Recherches par heure (heure de Moscou)", height: 300,
  x: {label: null, type: "utc", tickFormat: "%H h"},
  y: {label: null, grid: true},
  marks: [Plot.rectY(parHeure, {x1: "t", x2: (d) => new Date(+d.t + 36e5), y: "n", fill: "var(--theme-foreground-focus)", inset: 0.5, tip: true}), Plot.ruleY([0])]
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

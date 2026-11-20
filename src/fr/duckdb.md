---
title: SuperDB ou DuckDB
toc: {label: "Sommaire"}
---

# SuperDB et DuckDB : mêmes données, mêmes questions

DuckDB est le moteur auquel on compare le plus souvent SuperDB : un moteur SQL embarqué, en un seul exécutable, qui
lit lui aussi JSON et Parquet. Cette page les met tous deux à l'épreuve sur les trois jeux de données du site, avec
**une seule règle : chaque moteur tourne avec ses réglages par défaut**. Quand l'un échoue ou se trompe, c'est le
résultat. Ni réglage fin, ni contournement.

```js
import {loadBSUP} from "../components/superdb.js";
import {i18n} from "../components/i18n.js";
const duel = await loadBSUP(FileAttachment("../data/duckdb/duel.bsup"));
const duelOf = (test, engine) => duel.find((d) => d.dataset === "clickbench" && d.test === test && d.engine === engine && d.format === (engine === "superdb" ? "bsup" : "duckdb"));
const ingest = await loadBSUP(FileAttachment("../data/duckdb/ingest.bsup"));
```

```js
const {number, mb} = i18n("fr");
const engines = ["superdb", "duckdb"];
const engineName = {superdb: "SuperDB", duckdb: "DuckDB"};
const engineColor = {domain: engines, range: ["#4269d0", "#efb118"], tickFormat: (d) => engineName[d]};
const datasetName = {gha: "GitHub Archive (hétérogène)", bluesky: "Bluesky (semi-structuré)", clickbench: "ClickBench (table plate)"};
const kindOf = (d) => (d.format === "json.gz" ? "json" : d.format === "parquet" ? (d.variant === "clickhouse" ? "clickhouse" : "parquet") : "native");
const kindName = {json: "JSON brut (json.gz)", native: "Format natif (BSUP / .duckdb)", parquet: "Le même fichier Parquet", clickhouse: "Le Parquet de ClickHouse (chaînes non typées)"};
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
  <div class="card"><h2>Bluesky dans une base native</h2><span class="big">${ing("bluesky", "duckdb").error ? "DuckDB ✕" : "les deux ✓"}</span><br>SuperDB: ${(ing("bluesky", "superdb").ms / 1000).toLocaleString("fr-CA", {maximumFractionDigits: 1})} s ; DuckDB : ${ing("bluesky", "duckdb").error ? "erreur d'inférence de schéma" : (ing("bluesky", "duckdb").ms / 1000).toFixed(1) + " s"}</div>
  <div class="card"><h2>Duels gagnés</h2><span class="big">${score.superdb.wins} – ${score.duckdb.wins}</span><br>SuperDB – DuckDB, quand les deux répondent juste</div>
  <div class="card"><h2>Requêtes en échec</h2><span class="big">${score.superdb.failed} – ${score.duckdb.failed}</span><br>SuperDB – DuckDB, sur ${duel.length / 2} chacun</div>
  <div class="card"><h2>Réponses fausses</h2><span class="big">${score.superdb.wrong} – ${score.duckdb.wrong}</span><br>SuperDB – DuckDB, toutes sur le Parquet non typé de ClickHouse</div>
</div>

<p class="muted">En ligne de commande, sur cette machine : <code>super</code> ${version.superdb} et <code>duckdb</code> ${version.duckdb},
meilleur de trois essais, démarrage du processus compris pour les deux. La réponse de référence à chaque question est
celle de SuperDB sur BSUP ; les nombres de toutes les autres réponses y sont comparés.</p>

## Étape 1 : charger les données

Avant d'interroger, chaque moteur peut convertir les fichiers bruts dans son format natif : BSUP pour SuperDB, une base
`.duckdb` pour DuckDB. Mêmes fichiers, réglages par défaut (`CREATE TABLE … AS FROM 'fichier'` pour DuckDB).

```js
const ingestRows = ingest.map((d) => ({...d, label: datasetName[d.dataset]}));
display(Plot.plot({
  marginLeft: 220, marginRight: 230, height: 210,
  x: {label: "Secondes", grid: true, transform: (d) => d / 1000},
  y: {axis: null, domain: engines},
  fy: {label: null, domain: Object.values(datasetName)},
  color: {...engineColor, legend: true},
  marks: [
    Plot.barX(ingestRows.filter((d) => !d.error), {x: "ms", y: "engine", fill: "engine", fy: "label", tip: {format: {y: false}}}),
    Plot.text(ingestRows.filter((d) => !d.error), {x: "ms", y: "engine", fy: "label", text: (d) => `${(d.ms / 1000).toLocaleString("fr-CA", {maximumFractionDigits: 1})} s → ${mb(d.bytes)}`, dx: 4, textAnchor: "start"}),
    Plot.text(ingestRows.filter((d) => d.error), {x: 0, y: "engine", fy: "label", text: (d) => `✕ ${engineName[d.engine]}: ${shortError(d.error)}`, fill: "var(--theme-red)", dx: 4, textAnchor: "start"}),
    Plot.ruleX([0])
  ]
}));
```

<details><summary>L'erreur de DuckDB sur Bluesky</summary>
<pre class="error">${ing("bluesky", "duckdb").error ?? "none"}</pre>
DuckDB devine un schéma de table à partir d'un échantillon du fichier. Un champ qui apparaît pour la première fois après
l'échantillon (ici à la ligne 22 303 sur un million) fait échouer le chargement. SuperDB n'a pas de schéma à deviner :
chaque valeur porte son propre type.
</details>

## Étape 2 : les mêmes questions

Chaque ligne est une question ; les points donnent le temps de chaque moteur (échelle logarithmique, plus court est
meilleur), avec le facteur d'avance du gagnant. Un point creux est une réponse fausse, un ✕ un échec.

```js
const dataset = view(Inputs.radio(new Map(Object.entries(datasetName).map(([k, v]) => [v, k])), {label: "Jeu de données", value: "gha"}));
```

```js
const shown = pairs.filter((p) => p.dataset === dataset);
const rows = shown.flatMap((p) => engines.map((e) => p[e] && {...p[e], kind: p.kind}).filter(Boolean));
const ratio = (p) => Math.max(p.superdb.ms, p.duckdb.ms) / Math.max(1, Math.min(p.superdb.ms, p.duckdb.ms));
const tests = [...new Set(shown.map((p) => p.test))];
const kindsShown = kinds.filter((k) => shown.some((p) => p.kind === k));
display(resize((width) => Plot.plot({
  width, marginLeft: 70, marginRight: 10, marginTop: 30, height: kindsShown.length * (tests.length * 24 + 40),
  x: {type: "log", label: "Millisecondes (échelle log)", grid: true, domain: [5, 5000], tickFormat: number},
  y: {label: null, domain: tests},
  fy: {label: null, domain: kindsShown, axis: null, padding: 0.3},
  color: {...engineColor, legend: true},
  marks: [
    Plot.text(kindsShown, {fy: (k) => k, text: (k) => kindName[k], frameAnchor: "top-left", dy: -18, dx: -66, fontWeight: 600, fontSize: 12}),
    Plot.link(shown.filter((p) => p.faster), {x1: (p) => p.superdb.ms, x2: (p) => p.duckdb.ms, y: "test", fy: "kind", stroke: "var(--theme-foreground-faint)"}),
    Plot.dot(rows.filter((d) => !d.error), {x: "ms", y: "test", fy: "kind", r: 5, stroke: "engine", strokeWidth: 2,
      fill: (d) => (d.same ? d.engine : "var(--theme-background)"),
      channels: {engine: {value: (d) => engineName[d.engine], label: "moteur"}, fichier: "file", answer: {value: (d) => (d.same ? "juste" : "fausse"), label: "réponse"}},
      tip: {format: {fill: false, stroke: false, fy: (k) => kindName[k]}}}),
    Plot.text(shown.filter((p) => p.faster), {x: (p) => Math.max(p.superdb.ms, p.duckdb.ms), y: "test", fy: "kind", dx: 9, textAnchor: "start",
      text: (p) => `×${ratio(p) < 10 ? ratio(p).toLocaleString("fr-CA", {maximumFractionDigits: 1, minimumFractionDigits: 1}) : Math.round(ratio(p))}`, fill: (p) => p.faster, fontWeight: 600}),
    Plot.text(rows.filter((d) => d.error), {frameAnchor: "right", y: "test", fy: "kind", dx: -4, dy: (d) => (d.engine === "superdb" ? -6 : 6),
      text: (d) => `✕ ${engineName[d.engine]}: ${shortError(d.error)}`, fill: "var(--theme-red)", textAnchor: "end"})
  ]
})));
```

<div class="card note">${dataset === "gha"
  ? html`Chaque événement GitHub a sa propre forme. Sur le JSON brut, SuperDB répond ${(d3.median(shown.filter((p) => p.kind === "json" && p.faster), (p) => p.duckdb.ms / p.superdb.ms)).toLocaleString("fr-CA", {maximumFractionDigits: 1})} fois plus vite (médiane) ; une fois chargés, les deux formats natifs sont proches, sauf pour <code>search+</code>, la recherche d'une phrase dans tous les champs : un seul <code>grep</code> pour SuperDB, une conversion de la ligne entière en texte pour DuckDB.`
  : dataset === "bluesky"
  ? html`DuckDB lit vite le JSON brut, mais avec les mêmes réglages par défaut il ne peut pas le charger dans sa propre base (étape 1) : il n'y a donc rien à y interroger. Sur le Parquet, écrit par SuperDB sans le seul champ que Parquet ne sait pas représenter (<code>commit.record</code>), DuckDB est plus rapide.`
  : html`Une seule forme, 105 colonnes plates : c'est le terrain de DuckDB. En format natif, les questions légères se jouent au démarrage du processus (SuperDB devant sur Q0 à Q8) ; sur les lourdes, DuckDB s'envole (Q33 : ${(+duelOf('Q33','superdb').ms/ +duelOf('Q33','duckdb').ms).toFixed(0)} fois plus vite). Sur le Parquet de ClickHouse, dont les chaînes sont des octets non typés, <em>les deux</em> moteurs trébuchent : SuperDB renvoie sans broncher zéro ligne pour Q12 et un compte de 0 au lieu de 95 pour Q20, et affiche les URL de Q33 en octets hexadécimaux (avec les bons comptes) ; DuckDB refuse Q20 avec une erreur et affiche les phrases de Q12 en octets échappés (avec les bons comptes).`}</div>

### Les requêtes côte à côte

```js
const test = view(Inputs.select(tests, {label: "Question"}));
const kind = view(Inputs.select(kindsShown, {label: "Fichiers", format: (k) => kindName[k]}));
```

```js
const pick = shown.find((p) => p.test === test && p.kind === kind) ?? shown.find((p) => p.test === test);
display(html`<div class="grid grid-cols-2">${engines.map((e) => {
  const d = pick[e];
  return html`<div><h3 style="color: ${engineColor.range[engines.indexOf(e)]}">${engineName[e]}${d ? html` <span class="muted">— ${d.file}</span>` : ""}</h3>
  ${d ? html`<pre>${d.query}</pre>
  ${d.error ? html`<pre class="error">${d.error}</pre>` : html`<p>${number(d.ms)} ms${d.same ? "" : html` — <span class="error">réponse fausse</span>`}</p><pre class="result">${d.result || "(aucune ligne)"}</pre>`}` : html`<p class="muted">non exécutée</p>`}</div>`;
})}</div>`);
```

## Étape 3 : dans le navigateur

Observable Framework intègre DuckDB-wasm (DuckDB-wasm 1.29, soit DuckDB 1.1.1) ; ce site ajoute SuperDB compilé en
wasm. Les deux tournent dans cette page, sur votre machine.

### Le même fichier JSON brut dans les deux moteurs

Les 30 000 premiers événements Bluesky, intacts (${mb(blueskyBytes)}), confiés tels quels aux deux moteurs ; puis la
première question de JSONBench (événements par collection). DuckDB les charge avec son SQL par défaut, comme en ligne de
commande : `CREATE TABLE bluesky AS FROM read_json('bluesky.json')`.

```js
import {SuperDBClient} from "../components/superdb-client.js";
const blueskyFile = FileAttachment("../data/duckdb/bluesky-30k.json");
const blueskyBytes = (await blueskyFile.arrayBuffer()).byteLength;
```

```js
const jsonGo = view(Inputs.button("Charger et interroger dans les deux moteurs"));
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
  ? html`<table class="race"><thead><tr><th></th><th>Charger les 30 000 événements</th><th>Événements par collection</th><th>Réponse</th></tr></thead>
    <tbody>${engines.map((e) => html`<tr><th>${engineName[e]}</th><td>${cell(jsonRace[e].load)}</td><td>${cell(jsonRace[e].query)}</td>
    <td>${jsonRace[e].query && !jsonRace[e].query.error ? [...jsonRace[e].query.value].slice(0, 3).map((d) => `${d.event}: ${number(Number(d.count))}`).join(", ") + "…" : ""}</td></tr>`)}</tbody></table>`
  : html`<p class="muted">Appuyez sur le bouton : les deux moteurs téléchargent et chargent les mêmes ${mb(blueskyBytes)} de JSON.</p>`);
```

### Une course sur des données plates

Les ${number(69354)} recherches de ClickBench, chaque moteur dans son format de prédilection : BSUP pour SuperDB, Parquet
pour DuckDB. Chaque question tourne trois fois ; le graphique garde le meilleur temps, décodage en objets JavaScript compris.

```js
const raceGo = view(Inputs.button("Lancer la course (quelques secondes)"));
```

```js
const raceQueries = [
  {name: "compte", superdb: "SELECT count() FROM searches", duckdb: "SELECT count(*) FROM searches"},
  {name: "distincts", superdb: "SELECT count(DISTINCT phrase) AS phrases, count(DISTINCT user) AS users FROM searches", duckdb: "SELECT count(DISTINCT phrase) AS phrases, count(DISTINCT \"user\") AS users FROM searches"},
  {name: "phrases fréquentes", superdb: "SELECT phrase, count() AS n FROM searches GROUP BY phrase ORDER BY n DESC, phrase LIMIT 10", duckdb: "SELECT phrase, count(*) AS n FROM searches GROUP BY phrase ORDER BY n DESC, phrase LIMIT 10"},
  {name: "sous-chaîne", superdb: "SELECT count() FROM searches WHERE phrase LIKE '%фильм%'", duckdb: "SELECT count(*) FROM searches WHERE phrase LIKE '%фильм%'"},
  {name: "par heure", superdb: "FROM searches | aggregate n:=count() by t:=bucket(ts, 1h) | sort t", duckdb: "SELECT date_trunc('hour', ts) AS t, count(*) AS n FROM searches GROUP BY t ORDER BY t"},
  {name: "par région", superdb: "SELECT region, count() AS n FROM searches GROUP BY region ORDER BY n DESC LIMIT 20", duckdb: "SELECT region, count(*) AS n FROM searches GROUP BY region ORDER BY n DESC LIMIT 20"}
];
const race = raceGo ? await (async () => {
  const sl = await timed(() => SuperDBClient.of({searches: FileAttachment("../data/clickbench/searches.bsup")}));
  const kl = await timed(() => DuckDBClient.of({searches: FileAttachment("../data/duckdb/searches.parquet")}));
  const out = [{name: "chargement", engine: "superdb", ms: sl.ms, error: sl.error}, {name: "chargement", engine: "duckdb", ms: kl.ms, error: kl.error}];
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
      marginLeft: 110, marginRight: 60, height: 320,
      x: {label: "Millisecondes (meilleur de trois)", grid: true},
      y: {label: null, domain: ["chargement", ...raceQueries.map((q) => q.name)]},
      fy: {axis: null, domain: engines}, color: {...engineColor, legend: true},
      marks: [
        Plot.barX(race.filter((d) => d.ms != null), {x: "ms", y: "name", fill: "engine", fy: "engine", tip: {format: {fy: false}}}),
        Plot.text(race.filter((d) => d.ms != null), {x: "ms", y: "name", fy: "engine", text: (d) => `${number(Math.round(d.ms))} ms`, dx: 4, textAnchor: "start"}),
        Plot.text(race.filter((d) => d.error), {x: 0, y: "name", fy: "engine", text: (d) => `✕ ${d.error.slice(0, 80)}`, fill: "var(--theme-red)", dx: 4, textAnchor: "start"}),
        Plot.ruleX([0])
      ]
    })
  : html`<p class="muted">Appuyez sur le bouton pour faire courir les deux moteurs dans ce navigateur.</p>`);
```

<p class="muted">« chargement » comprend le téléchargement du moteur (le wasm de SuperDB fait ${mb(6.8e6)} compressé, celui de DuckDB-wasm à peu près autant), sauf s'il est déjà en cache.
Le <code>date_trunc</code> de DuckDB 1.1 n'accepte pas les horodatages à la nanoseconde, la précision qu'écrit SuperDB en Parquet : c'est l'erreur de « par heure ».</p>

## Ce qu'il faut en retenir

- **Les données qui changent de forme sont le terrain de SuperDB.** Aucun schéma à deviner, donc rien ne casse quand un
  champ rare apparaît ; le JSON brut est interrogé plus vite ; un seul `grep` cherche dans tous les champs ;
  `UNNEST [...a, b]` remplace un `UNION ALL` de deux sous-requêtes.
- **Les tables plates et typées sont celles de DuckDB.** Sur ClickBench, son format natif est plusieurs fois plus rapide et
  ses fichiers sont plus petits que le BSUP. Sur Parquet, le résultat dépend de la question.
- **Les types comptent pour les deux.** Aucun des deux moteurs ne retrouve des chaînes qu'un fichier Parquet stocke en octets non typés.

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

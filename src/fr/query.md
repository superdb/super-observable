---
title: SuperSQL en direct
toc: {label: "Sommaire"}
---

# SuperSQL en direct (moteur wasm)

Le moteur SuperDB complet tourne **dans le navigateur**, dans un Web Worker (Go → wasm).
Les sources sont chargées une fois, puis chaque requête ne renvoie que son résultat, en BSUP.

```js
import {SuperDBClient} from "../components/superdb-client.js";
const t0 = performance.now();
const db = await SuperDBClient.of({
  sales: FileAttachment("../data/sales.bsup"),
  events: FileAttachment("../data/events.bsup"),
  gha: FileAttachment("../data/gha/events.bsup")
});
const initMs = performance.now() - t0;
```

<p class="muted">Moteur ${db.version}, prêt en ${initMs.toFixed(0)} ms (téléchargement du wasm et des sources compris).
Sources : ${(await db.describeTables()).map((d) => html`<code>${d.name}</code>`).reduce((a, b) => html`${a}, ${b}`)}.</p>

## Éditeur

```js
const exemples = {
  "Ventes par région": "from sales\n| aggregate total:=sum(amount), n:=count() by region\n| sort -r total",
  "SQL : top clients": "select customer, sum(amount) as total, count(*) as n\nfrom sales\ngroup by customer\norder by total desc\nlimit 10",
  "Événements : formes": "from events\n| count() by kind, shape:=typeof(this)\n| sort kind",
  "Erreurs : code entier ou texte": "from events\n| where kind='error'\n| aggregate n:=count() by code_type:=typeof(code), with_retry:=has(this, 'retry')\n| sort n",
  "GHA : étiquettes les plus fréquentes": "from gha\n| unnest labels\n| aggregate n:=count() by label:=this\n| sort -r n\n| limit 15",
  "GHA : PR fusionnées par langage": "from gha\n| where type=='PullRequestEvent' and action=='closed' and language is not null\n| aggregate merged:=count() filter (merged), closed:=count() by language\n| values {...this, rate:round(100*merged/closed)}\n| where closed >= 50\n| sort -r closed"
};
const exemple = view(Inputs.select(Object.keys(exemples), {label: "Exemple"}));
```

```js
const requete = view(Inputs.textarea({value: exemples[exemple], rows: 7, width: "100%", submit: "Exécuter (⌘↩)", monospace: true, spellcheck: false}));
```

```js
const resultat = await (async () => {
  const t = performance.now();
  try {
    const rows = await db.query(requete);
    return {rows, moteur: db.lastMs, total: performance.now() - t};
  } catch (error) {
    return {error};
  }
})();
```

```js
resultat.error
  ? html`<pre class="erreur">${resultat.error.message}</pre>`
  : html`<p class="muted">${resultat.rows.length.toLocaleString("fr-CA")} valeurs — moteur ${resultat.moteur.toFixed(0)} ms, total avec décodage ${resultat.total.toFixed(0)} ms</p>`
```

```js
resultat.error ? null : Inputs.table(resultat.rows, {rows: 12})
```

<details><summary>Résultat en SUP</summary>

```js
resultat.error ? null : html`<pre>${resultat.rows.values.slice(0, 50).map((v) => sup(v)).join("\n")}</pre>`
```

</details>

```js
import {formatValue as sup} from "../components/super-ts.js";
```

## Requêtes paramétrées et réactives

Le gabarit `db.sql` insère les valeurs JS comme littéraux SuperSQL ; le graphique se recalcule à chaque changement.

```js
const regions = (await db.sql`from sales | aggregate n:=count() by region | sort region`).map((d) => d.region);
const region = view(Inputs.select(regions, {label: "Région"}));
const seuil = view(Inputs.range([0, 20000], {label: "Montant minimum", step: 500, value: 0}));
```

```js
const parMois = await db.sql`
  from sales
  | where region = ${region} and amount >= ${seuil}
  | aggregate total:=sum(amount), n:=count() by month:=strftime('%Y-%m-01T00:00:00Z', date)::timestamp
  | sort month`;
const parMoisMs = db.lastMs;
```

```js
Plot.plot({
  height: 260,
  y: {label: `Ventes ${region} ($)`, grid: true, tickFormat: "s"},
  marks: [Plot.areaY(parMois, {x: "month", y: "total", fillOpacity: 0.2}), Plot.lineY(parMois, {x: "month", y: "total", tip: true}), Plot.ruleY([0])]
})
```

<p class="muted">Requête exécutée en ${parMoisMs.toFixed(0)} ms dans le moteur.</p>

## Schéma des sources

```js
const source = view(Inputs.select((await db.describeTables()).map((d) => d.name), {label: "Source", value: "gha"}));
```

```js
Inputs.table(await db.describeColumns({table: source}), {rows: 12})
```

<style>
.muted { color: var(--theme-foreground-muted); }
pre.erreur { color: var(--theme-red); white-space: pre-wrap; }
</style>

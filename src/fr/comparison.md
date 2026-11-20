---
title: Hétérogène ou homogène ?
toc: {label: "Sommaire"}
---

# BSUP ou Parquet, selon la forme des données

Trois jeux publics, du plus irrégulier au plus régulier, interrogés par le même moteur (`super`, en ligne
de commande, au build) dans des formats différents. Ce qui varie : le nombre de **formes**
(types de premier niveau distincts) par rapport au nombre de lignes.

```js
import {loadBSUP} from "../components/superdb.js";
import {i18n, datasetNames as noms} from "../components/i18n.js";
const profils = await loadBSUP(FileAttachment("../data/comparison/profiles.bsup"));
const tailles = await loadBSUP(FileAttachment("../data/comparison/sizes.bsup"));
const banc = [
  ...(await loadBSUP(FileAttachment("../data/gha/bench.bsup"))),
  ...(await loadBSUP(FileAttachment("../data/bluesky/bench.bsup"))),
  ...(await loadBSUP(FileAttachment("../data/clickbench/bench.bsup")))
];
```

```js
const {number: nombre, mb: mo, format, variant, fileLabel: etiquette} = i18n("fr");
const jeux = ["gha", "bluesky", "clickbench"];
const descriptions = {
  gha: "Événements GitHub imbriqués ; une forme par événement.",
  bluesky: "Firehose Bluesky ; enveloppe fixe, contenu des posts variable.",
  clickbench: "Table de journaux web plate, 105 colonnes ; une seule forme."
};
const formats = ["json.gz", "bsup", "parquet"].map(format);
```

<div class="grid grid-cols-3">
${profils.map((p) => html`<div class="card">
  <h2>${noms[p.dataset]}</h2>
  <span class="big">${nombre(p.shapes)}</span> forme${p.shapes > 1 ? "s" : ""}
  pour ${nombre(p.rows)} lignes<br>
  <span class="muted">${descriptions[p.dataset]}</span>
</div>`)}
</div>

## Taille sur disque

```js
const maxOctets = d3.max(tailles, (d) => d.bytes);
display(Plot.legend({color: {domain: formats}}));
for (const jeu of jeux) {
  const t = tailles.filter((d) => d.dataset === jeu);
  display(Plot.plot({
    title: noms[jeu], marginLeft: 230, marginRight: 70, height: 30 + 26 * t.length,
    x: {label: "Mo", grid: true, domain: [0, maxOctets / 1e6], transform: (d) => d / 1e6, axis: jeu === "clickbench" ? "bottom" : null},
    y: {label: null, domain: t.map(etiquette)},
    color: {domain: formats},
    marks: [
      Plot.barX(t, {x: "bytes", y: etiquette, fill: (d) => format(d.format), tip: {format: {x: (d) => mo(d * 1e6)}}}),
      Plot.text(t, {x: "bytes", y: etiquette, text: (d) => mo(d.bytes, 0), dx: 4, textAnchor: "start"}),
      Plot.ruleX([0])
    ]
  }));
}
```

<p class="muted">Sur GHA, Parquet doit fusionner 22 845 formes en un seul schéma clairsemé : il est trois fois plus
gros que BSUP. Sur ClickBench, plat, le Parquet d'origine (compressé par ClickHouse) est le plus petit ; celui
qu'écrit <code>super</code> est plus gros que BSUP. Pour Bluesky, seul le BSUP garde tous les champs : le fichier
complet ne passe pas en Parquet (<i>unsupported type: empty record</i>).</p>

## Durée des requêtes

Rapport *durée Parquet ÷ durée BSUP* pour chaque requête : au-dessus de 1, BSUP est plus rapide.
Requêtes du [tutoriel performance](https://superdb.org/tutorials/performance.html) pour GHA, de
[JSONBench](https://github.com/ClickHouse/JSONBench) pour Bluesky, de
[ClickBench](https://github.com/ClickHouse/ClickBench) pour hits. Meilleur de trois essais ; chaque essai
comprend le démarrage de `super` (environ 10 ms).

```js
// Pour Bluesky, la référence est le BSUP sans commit.record : même contenu que son fichier Parquet.
const reference = new Map(banc.filter((d) => d.format === "bsup" && (d.variant ?? null) === (d.dataset === "bluesky" ? "no-record" : null))
  .map((d) => [`${d.dataset}/${d.test}`, d]));
const rapports = banc.filter((d) => d.format === "parquet" && d.ms != null).map((d) => {
  const b = reference.get(`${d.dataset}/${d.test}`);
  return {...d, bsupMs: b.ms, rapport: d.ms / b.ms, identique: d.result === b.result, parquet: variant(d.variant)};
});
const couleurs = {domain: ["fused", "no-record", "super", "clickhouse"].map(variant)};
const symboles = {domain: ["identique", "différent"]};
display(Plot.legend({color: couleurs}));
display(Plot.legend({symbol: symboles}));
for (const jeu of jeux) {
  const r = rapports.filter((d) => d.dataset === jeu);
  display(Plot.plot({
    title: noms[jeu], marginLeft: 60, height: 30 + 22 * new Set(r.map((d) => d.test)).size,
    x: {type: "log", domain: [0.45, 9], label: null, grid: true, ticks: [0.5, 1, 2, 4, 8], tickFormat: (d) => d + "×", axis: jeu === "clickbench" ? "bottom" : null},
    y: {label: null, domain: [...new Set(r.map((d) => d.test))]},
    color: couleurs, symbol: symboles,
    marks: [
      Plot.ruleX([1]),
      Plot.dot(r, {x: "rapport", y: "test", stroke: "parquet", symbol: (d) => (d.identique ? "identique" : "différent"), r: 5, strokeWidth: 2,
        tip: {channels: {bsup: {value: "bsupMs", label: "BSUP (ms)"}, pq: {value: "ms", label: "Parquet (ms)"}}, format: {x: (d) => d.toFixed(1) + "×"}}})
    ]
  }));
}
display(html`<p class="muted">Durée Parquet ÷ durée BSUP, échelle log.</p>`);
```

<p class="muted">Le Parquet d'origine de ClickBench stocke les textes en <code>bytes</code> (sans annotation de chaîne) :
sur ce fichier, Q12 et Q20 répondent à côté (aucune phrase, 0 URL contenant « google ») et Q33 renvoie des URL en
hexadécimal. Ses durées ne sont donc pas comparables pour ces requêtes (symbole « différent »). Le BSUP et le Parquet
« écrit par super » partent d'une conversion typée (<code>queries/hits-cast.spq</code>).</p>

```js
const jeuChoisi = view(Inputs.select(jeux, {label: "Jeu", format: (d) => noms[d], value: "clickbench"}));
```

```js
const lignes = banc.filter((d) => d.dataset === jeuChoisi);
const tests = [...new Set(lignes.map((d) => d.test))];
const fichiers = [...new Set(lignes.map(etiquette))];
const tableau = tests.map((test) => Object.fromEntries([["requête", test], ...fichiers.map((f) => [f, lignes.find((d) => d.test === test && etiquette(d) === f)?.ms ?? null])]));
display(Inputs.table(tableau, {format: Object.fromEntries(fichiers.map((f) => [f, (d) => (d == null ? "échec" : d + " ms")])), layout: "auto"}));
```

<details><summary>Texte des requêtes</summary>

```js
display(html`${tests.map((t) => html`<p><b>${t}</b></p><pre>${lignes.find((d) => d.test === t).query}</pre>`)}`);
```

</details>

## À retenir

- **Hétérogène (GHA)** : BSUP est 3 fois plus petit que le Parquet fusionné et plus rapide sur toutes les requêtes ;
  Parquet n'est même pas une option naturelle, il faut d'abord inventer un schéma.
- **Semi-structuré (Bluesky)** : Parquet n'accepte le jeu qu'après avoir retiré la partie irrégulière
  (`commit.record`) ; même alors, les requêtes JSONBench sont 2 à 4 fois plus lentes qu'en BSUP.
- **Plat (ClickBench)** : c'est le terrain de Parquet. Le fichier de ClickHouse est le plus compact, et ses
  durées restent proches de celles de BSUP sur les agrégats ; celui qu'écrit `super` est plus gros et nettement
  plus lent. Il faut aussi des types de texte corrects pour que les requêtes sur chaînes aient un sens.
- Tous les chiffres viennent d'un seul moteur (`super`) sur une seule machine : c'est une comparaison de
  **formats**, pas de moteurs.

<style>
.big { font-size: 1.6rem; font-weight: 600; }
.muted { color: var(--theme-foreground-muted); }
</style>

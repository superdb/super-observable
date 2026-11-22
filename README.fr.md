# Prototype SuperDB pour Observable Framework (niveau 1)

*[English](README.md)*

Les data loaders `src/data/*.sh` exécutent `bin/super` (compilé depuis superdb/super@main)
au build. Les pages décodent le BSUP avec super-ts (`vendor-super-ts`, regroupé dans
`src/components/super-ts.js`).

    git clone --recurse-submodules https://github.com/superdb/super-observable && cd super-observable
    GOBIN=$PWD/bin go install github.com/superdb/super/cmd/super@main
    npm install && npm run build-lib && npm run data
    npm run dev          # aperçu : http://127.0.0.1:3000
    npm run build && npm run bench    # banc Node sur dist/

## Niveau 2 : moteur SuperDB dans le navigateur

`wasm/main.go` compile le moteur Go en wasm (`src/lib/super.wasm`) ; `src/components/superdb-client.js`
le lance dans un Web Worker et expose `SuperDBClient` (interface DatabaseClient d'Observable).

    wasm/build.sh

Le script applique `wasm/super-wasm.patch` à une copie du module super (`wasm/.super-src`, cible du
`replace` de `go.mod`) puis compile avec `-tags noarrow,nos3` : Arrow, Parquet et S3 sont exclus.
Résultat : 32 Mo au lieu de 96 (6,8 Mo gzip, 4,6 Mo brotli, contre 16,4 et 10,9). Dans le navigateur,
les sources doivent donc être en BSUP, CSUP, JSON, CSV, SUP… pas en Parquet ni en Arrow.

```js
import {SuperDBClient} from "./components/superdb-client.js";
const db = await SuperDBClient.of({sales: FileAttachment("data/sales.bsup")});
const rows = await db.sql`from sales | where region = ${region} | aggregate sum(amount)`;
```

Tests : `node scripts/test-wasm.mjs <sales.bsup> <sales.parquet> <gha/events.bsup>` (Node) et
`node scripts/check-site.mjs` (Chrome headless, toutes les pages dans les deux langues, site servi sur :4321).

## Bilingue

Anglais par défaut à la racine (`src/*.md`), français sous `src/fr/` avec les mêmes noms de page.
Les loaders et les données utilisent des noms de champs anglais et des codes neutres (`format` : `json.gz`,
`bsup`, `parquet` ; `variant` : `full`, `no-record`, `fused`, `projection`, `super`, `clickhouse`) que chaque page
traduit via `src/components/i18n.js`. `observablehq.config.js` : une section « English » et une « Français » dans
la barre latérale, un lien vers la page jumelle dans l'en-tête, un pied de page par langue, pas de pager.
Quand on modifie une page, il faut modifier sa jumelle.

## Démo GitHub Archive (`src/gha.md`)

L'échantillon « GHA Sample » des bancs d'essai de SuperDB (22 845 événements, une forme distincte chacun).
`scripts/get-gha.sh` le télécharge (49 Mo) et le convertit en BSUP et en Parquet dans `raw/gha/` (environ 500 Mo
au total) ; les loaders `src/data/gha/*.bsup.sh` l'appellent au besoin. `bench.bsup.sh` exécute les cinq
requêtes du tutoriel de performance (`node scripts/run-bench.mjs gha`).

## Démo Bluesky (`src/bluesky.md`)

Un million d'événements Bluesky (fichier 1 de [JSONBench](https://github.com/ClickHouse/JSONBench), issues
SuperDB #7484 et #7480) : 565 formes, dont 403 pour les posts. `scripts/get-bluesky.sh` télécharge 135 Mo
et produit `raw/bluesky/bluesky.bsup` (complet) ainsi que `bluesky-sansrecord.{bsup,parquet}` : le fichier
complet ne passe pas en Parquet (`unsupported type: empty record`). Le navigateur ne charge qu'une projection
des 86 812 posts (`queries/bluesky-posts.spq`, 9 Mo) pour l'explorateur wasm.

## Démo ClickBench (`src/clickbench.md`)

`hits_0.parquet` (1 M de visites, 105 colonnes, une forme). Loaders `src/data/clickbench/` : `columns` (type et
taux de remplissage de chaque colonne, environ 1 min 20 s au build), `traffic` (visites par 10 min), `sizes`, `bench`
et `searches` (les 69 354 visites avec une phrase de recherche, 1,8 Mo, pour l'explorateur wasm). `EventTime` est
traité comme l'heure de Moscou (UTC+4 en 2013).

## Démo Québec (`src/quebec.md`)

Données ouvertes de Données Québec, téléchargées par `scripts/get-quebec.sh` dans `raw/quebec/` et `geo/` :
le Répertoire des municipalités (MAMH, `MUN.csv`), l'historique des populations par décret depuis 1986 (XML,
converti par `scripts/quebec_pop.py`) et les découpages administratifs au 1/100 000 (MRNF, shapefiles convertis
et simplifiés en GeoJSON par `scripts/shp2geojson.py`, en Python pur). Loaders `src/data/quebec/` :
`municipalities` (champs statistiques seulement, sans élus ni coordonnées ; 86 ko), `population` (180 ko) et
`geometry` (polygones des municipalités et des régions en BSUP, 408 ko).

La page fait le tour des marques de Plot et de d3 : carte choroplèthe et cercles proportionnels (`Plot.geo`,
`Plot.centroid`), treemap `d3.treemap`, gaufres (`waffleY`), histogramme logarithmique, nuage de points avec contours
de densité et recherche liée à un tableau, boîtes à moustaches, courbe en escalier annotée, aires, petits multiples
indexés, flèches, histogramme temporel, barres groupées et explorateur SuperSQL wasm.

## SuperDB ou DuckDB (`src/duckdb.md`)

Comparaison avec DuckDB sur les trois jeux de données, **chaque moteur avec ses réglages par défaut** : un échec ou une
réponse fausse est un résultat, jamais contourné.

- Prérequis : `brew install duckdb` (testé avec 2.0.0 ; toujours appeler `duckdb -no-agent`).
- `scripts/get-duckdb.sh` charge chaque jeu dans le format natif de chaque moteur (BSUP, `.duckdb`) et chronomètre
  (`raw/duckdb/ingest.jsonl`). DuckDB échoue sur Bluesky : inférence de schéma par échantillon, champ inconnu ligne 22 303.
- `scripts/run-duel.mjs` exécute les mêmes questions (JSON brut, natif, Parquet, Parquet de ClickHouse), meilleur de
  trois, et compare les nombres de chaque réponse à celle de SuperDB sur BSUP. Le chargeur `src/data/duckdb/duel.bsup.sh`
  l'appelle (~2 min, mis en cache par Framework).
- Dans le navigateur : SuperDB wasm (BSUP) contre le DuckDB-wasm intégré à Framework (1.29 = DuckDB 1.1.1, Parquet).
  `DuckDBClient.of` ne sait pas charger du NDJSON ; la page passe par `registerFileURL` + `read_json`, le SQL par défaut.

Constats et analyse : voir `PROPOSAL.md`.

## Comparaison hétérogène / homogène (`src/comparison.md`)

GHA (une forme par ligne), Bluesky (565 formes pour 1 M de lignes) et ClickBench `hits_0.parquet`
(1 forme, 105 colonnes ; `scripts/get-clickbench.sh`, 122 Mo). Le Parquet d'origine de ClickBench stocke les
textes en `bytes` : `queries/hits-cast.spq` en fait un BSUP typé, que `super` réécrit aussi en Parquet.
`scripts/run-bench.mjs <jeu>…` exécute les requêtes de chaque jeu (tutoriel performance, JSONBench q1–q5,
ClickBench Q0/Q2/Q5/Q8/Q12/Q20/Q33) sur chaque format, meilleur de trois essais.

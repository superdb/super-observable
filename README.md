# SuperDB × Observable Framework

*[Français](README.fr.md)*

A prototype that brings [SuperDB](https://github.com/superdb/super) to [Observable Framework](https://observablehq.com/framework/), at two levels:

1. **Build time:** data loaders run `super` and write BSUP. Pages decode it with [super-ts](https://github.com/superdb/super-ts).
2. **In the browser:** the SuperDB engine compiled to wasm runs in a Web Worker behind `SuperDBClient`, which implements Framework's `DatabaseClient` interface.

It includes demo dashboards on public data (GitHub Archive, Bluesky, ClickBench, Quebec open data) and a comparison with DuckDB. [`PROPOSAL.md`](PROPOSAL.md) ([PDF](PROPOSAL.pdf)) explains the motivation, the design and the findings.

## Quick start

Prerequisites: Go, Node.js 20+, Python 3, about 2 GB of disk for the raw data. The comparison page also needs the DuckDB CLI (`brew install duckdb`), and the automated checks need Google Chrome.

    git clone --recurse-submodules https://github.com/superdb/super-observable && cd super-observable
    GOBIN=$PWD/bin go install github.com/superdb/super/cmd/super@main
    npm install && npm run build-lib && npm run data
    wasm/build.sh        # → src/lib/super.wasm
    npm run dev          # preview: http://127.0.0.1:3000
    npm run build && npm run bench    # Node benchmark on dist/

The data loaders download the public datasets into `raw/` the first time a page needs them.

## Level 1: BSUP data loaders

The data loaders in `src/data/*.sh` run `bin/super`, built from superdb/super@main, during the build. They write BSUP, which keeps every SuperDB type. The pages decode it with super-ts: `vendor-super-ts` is a submodule, and `npm run build-lib` bundles it into `src/components/super-ts.js`.

## Level 2: the SuperDB engine in the browser

`wasm/main.go` compiles the Go engine to wasm (`src/lib/super.wasm`). `src/components/superdb-client.js` runs it in a Web Worker and exposes `SuperDBClient`.

```js
import {SuperDBClient} from "./components/superdb-client.js";
const db = await SuperDBClient.of({sales: FileAttachment("data/sales.bsup")});
const rows = await db.sql`from sales | where region = ${region} | aggregate sum(amount)`;
```

`wasm/build.sh` applies `wasm/super-wasm.patch` to a copy of the super module in `wasm/.super-src`, which `go.mod` points to with a `replace` directive. It then builds with `-tags noarrow,nos3`, which leaves out Arrow, Parquet and S3.

The result is 32 MB instead of 96 MB: 6.8 MB gzipped and 4.6 MB with brotli, against 16.4 and 10.9 MB for the full build. Browser sources must therefore be BSUP, CSUP, JSON, CSV, SUP and so on, not Parquet or Arrow.

Tests:
- `node scripts/test-wasm.mjs <sales.bsup> <sales.parquet> <gha/events.bsup>` runs in Node.
- `node scripts/check-site.mjs` loads every page in both languages in headless Chrome. It expects the site to be served on port 4321.

## Two languages

English pages sit at the root (`src/*.md`), and French pages sit under `src/fr/` with the same names. When you change a page, change its twin too.

Loaders and data use English field names and neutral codes:
- `format`: `json.gz`, `bsup`, `parquet`;
- `variant`: `full`, `no-record`, `fused`, `projection`, `super`, `clickhouse`.

Each page translates these codes through `src/components/i18n.js`.

`observablehq.config.js` sets up:
- one sidebar section per language;
- a link to the twin page in the header;
- a footer for each language;
- no pager.

## Demos

### GitHub Archive (`src/gha.md`)

This is the "GHA Sample" from SuperDB's benchmarks: 22,845 events, each with a distinct shape.

- `scripts/get-gha.sh` downloads it (49 MB) and converts it to BSUP and Parquet in `raw/gha/` (about 500 MB in all).
- `bench.bsup.sh` runs the five queries of the performance tutorial (`node scripts/run-bench.mjs gha`).

### Bluesky (`src/bluesky.md`)

This is one million Bluesky events: file 1 of [JSONBench](https://github.com/ClickHouse/JSONBench) (see superdb/super#7484 and #7480). The file has 565 shapes, 403 of them for posts.

`scripts/get-bluesky.sh` downloads 135 MB and produces two outputs:
- `raw/bluesky/bluesky.bsup`, the full file;
- `bluesky-sansrecord.{bsup,parquet}`, a copy without the `record` field. The full file can't be written as Parquet (`unsupported type: empty record`).

The browser loads only a projection of the 86,812 posts (`queries/bluesky-posts.spq`, 9 MB) for the wasm explorer.

### ClickBench (`src/clickbench.md`)

`hits_0.parquet` holds 1M visits in 105 columns, all with one shape. `EventTime` is treated as Moscow time (UTC+4 in 2013).

The loaders in `src/data/clickbench/` are:
- `columns`: the type and fill rate of each column (about 1 min 20 s at build time);
- `traffic`: visits per 10 minutes;
- `sizes`;
- `bench`;
- `searches`: the 69,354 visits with a search phrase (1.8 MB), for the wasm explorer.

### Quebec (`src/quebec.md`)

`scripts/get-quebec.sh` downloads Données Québec open data:
- the municipal directory (MAMH, `MUN.csv`);
- population by decree since 1986 (XML, converted by `scripts/quebec_pop.py`);
- 1:100,000 administrative boundaries (MRNF shapefiles, which `scripts/shp2geojson.py` converts and simplifies to GeoJSON in pure Python).

The loaders in `src/data/quebec/` are:
- `municipalities`: statistical fields only, 86 KB;
- `population`: 180 KB;
- `geometry`: the municipality and region polygons in BSUP, 408 KB.

The page tours the marks of Plot and d3. It shows:
- a choropleth and proportional circles;
- a treemap, waffles and a log histogram;
- a scatterplot with density contours, linked to a table;
- box plots and an annotated step curve;
- areas, indexed small multiples and arrows;
- a temporal histogram and grouped bars;
- a SuperSQL wasm explorer.

### SuperDB or DuckDB (`src/duckdb.md`)

This page compares the two engines on the three datasets, **each engine with its default settings**. A failure or a wrong answer is a result; nothing is worked around.

- **Prerequisite:** `brew install duckdb`. It was tested with 2.0.0; always run `duckdb -no-agent`.
- **Ingestion:** `scripts/get-duckdb.sh` loads each dataset into each engine's native format (BSUP, `.duckdb`) and times it (`raw/duckdb/ingest.jsonl`). DuckDB fails on Bluesky, because it infers the schema from a sample and finds an unknown field at line 22,303.
- **Queries:** `scripts/run-duel.mjs` runs the same questions on each format: raw JSON, native, Parquet, and ClickHouse's Parquet. It keeps the best of three runs and compares the numbers in each answer with SuperDB's answer on BSUP. The loader `src/data/duckdb/duel.bsup.sh` calls it; it takes about 2 minutes, and Framework caches the result.
- **In the browser:** SuperDB wasm (BSUP) runs against the DuckDB-wasm bundled with Framework (1.29, which is DuckDB 1.1.1, on Parquet). `DuckDBClient.of` can't load NDJSON, so the page uses `registerFileURL` and `read_json` with the default SQL.

The findings are in [`PROPOSAL.md`](PROPOSAL.md).

### Heterogeneous or homogeneous data (`src/comparison.md`)

This page compares three datasets:
- GHA: one shape per row;
- Bluesky: 565 shapes in 1M rows;
- ClickBench `hits_0.parquet`: one shape, 105 columns (`scripts/get-clickbench.sh`, 122 MB).

ClickBench's original Parquet stores text as `bytes`. `queries/hits-cast.spq` turns it into typed BSUP, which `super` also rewrites as Parquet.

`scripts/run-bench.mjs <dataset>…` runs each dataset's queries on each format and keeps the best of three runs. The queries come from the performance tutorial, JSONBench q1–q5, and ClickBench Q0, Q2, Q5, Q8, Q12, Q20 and Q33.

## License

[SuperDB Source Available License](LICENSE.md), the same license as superdb/super.

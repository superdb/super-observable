#!/bin/sh
# Time and size to load each dataset into each engine's native format (see scripts/get-duckdb.sh).
set -eu
for d in gha bluesky clickbench duckdb; do scripts/get-$d.sh >&2; done
bin/super -i json -f bsup raw/duckdb/ingest.jsonl

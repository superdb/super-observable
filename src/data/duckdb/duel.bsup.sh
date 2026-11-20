#!/bin/sh
# SuperDB vs DuckDB on the command line: every dataset, every format, default settings (see scripts/run-duel.mjs).
set -eu
for d in gha bluesky clickbench duckdb; do scripts/get-$d.sh >&2; done
node scripts/run-duel.mjs | bin/super -i json -f bsup -

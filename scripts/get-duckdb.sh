#!/bin/sh
# Loads each dataset into each engine's native format with default settings, timing it.
# A failure is a result: it is recorded with its error, never worked around.
# Writes raw/duckdb/{gha,bluesky,clickbench}.duckdb (when DuckDB succeeds) and raw/duckdb/ingest.jsonl. Idempotent.
set -eu
cd "$(dirname "$0")/.."
mkdir -p raw/duckdb
[ -f raw/duckdb/ingest.jsonl ] && exit 0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

ms() { python3 -c 'import time;print(int(time.time()*1000))'; }
ingest() { # dataset engine source target command...
  dataset=$1 engine=$2 source=$3 target=$4; shift 4
  rm -f "$target"
  t=$(ms)
  if "$@" >/dev/null 2>"$tmp/err"; then
    printf '{"dataset":"%s","engine":"%s","source":"%s","bytes":%s,"ms":%s,"error":null}\n' \
      "$dataset" "$engine" "$source" "$(wc -c < "$target" | tr -d " ")" "$(($(ms) - t))" >>"$tmp/ingest.jsonl"
  else
    rm -f "$target"
    python3 -c 'import json,sys; print(json.dumps({"dataset":sys.argv[1],"engine":sys.argv[2],"source":sys.argv[3],"bytes":None,"ms":None,"error":open(sys.argv[4]).read().strip()}))' \
      "$dataset" "$engine" "$source" "$tmp/err" >>"$tmp/ingest.jsonl"
  fi
}
duck() { db=$1; shift; duckdb -no-agent "$db" -c "$*"; }

ingest gha superdb json.gz "$tmp/gha.bsup" bin/super -i json -f bsup -o "$tmp/gha.bsup" raw/gha/ghasample.json.gz
ingest gha duckdb json.gz raw/duckdb/gha.duckdb duck raw/duckdb/gha.duckdb "CREATE TABLE gha AS FROM 'raw/gha/ghasample.json.gz'"
ingest bluesky superdb json.gz "$tmp/bluesky.bsup" bin/super -i json -f bsup -o "$tmp/bluesky.bsup" raw/bluesky/file_0001.json.gz
ingest bluesky duckdb json.gz raw/duckdb/bluesky.duckdb duck raw/duckdb/bluesky.duckdb "CREATE TABLE bluesky AS FROM 'raw/bluesky/file_0001.json.gz'"
ingest clickbench superdb parquet "$tmp/hits.bsup" bin/super -f bsup -o "$tmp/hits.bsup" raw/clickbench/hits-super.parquet
ingest clickbench duckdb parquet raw/duckdb/clickbench.duckdb duck raw/duckdb/clickbench.duckdb "CREATE TABLE hits AS FROM 'raw/clickbench/hits-super.parquet'"
mv "$tmp/ingest.jsonl" raw/duckdb/ingest.jsonl

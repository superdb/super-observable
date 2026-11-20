#!/bin/sh
# File sizes of a dataset, one JSON line per file: sizes.sh <dataset>
# format: json.gz | bsup | parquet ; variant: null | projection | fused | full | no-record | super | clickhouse
set -eu
t() { stat -f %z "$1"; }
l() { printf '{"dataset":"%s","format":"%s","variant":%s,"file":"%s","bytes":%s}\n' "$1" "$2" "$3" "$(basename "$4")" "$(t "$4")"; }
case "$1" in
gha)
  l gha json.gz null raw/gha/ghasample.json.gz
  l gha bsup null raw/gha/ghasample.bsup
  l gha parquet '"fused"' raw/gha/ghasample.parquet
  slim=$(mktemp)
  bin/super -dynamic -f bsup -I queries/gha-events.spq > "$slim"
  printf '{"dataset":"gha","format":"bsup","variant":"projection","file":"events.bsup","bytes":%s}\n' "$(t "$slim")"
  rm -f "$slim" ;;
bluesky)
  l bluesky json.gz null raw/bluesky/file_0001.json.gz
  l bluesky bsup '"full"' raw/bluesky/bluesky.bsup
  l bluesky bsup '"no-record"' raw/bluesky/bluesky-sansrecord.bsup
  l bluesky parquet '"no-record"' raw/bluesky/bluesky-sansrecord.parquet ;;
clickbench)
  l clickbench bsup null raw/clickbench/hits.bsup
  l clickbench parquet '"super"' raw/clickbench/hits-super.parquet
  l clickbench parquet '"clickhouse"' raw/clickbench/hits_0.parquet ;;
esac

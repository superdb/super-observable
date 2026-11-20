#!/bin/sh
# Télécharge 1 M d'événements Bluesky (JSONBench, file_0001) utilisés dans les issues SuperDB #7484 et #7480,
# et les convertit : BSUP complet, et BSUP/Parquet sans commit.record (Parquet refuse les records vides). Idempotent.
set -eu
cd "$(dirname "$0")/.."
mkdir -p raw/bluesky
d=raw/bluesky
[ -f $d/file_0001.json.gz ] || curl -sSf -o $d/file_0001.json.gz https://clickhouse-public-datasets.s3.amazonaws.com/bluesky/file_0001.json.gz
[ -f $d/bluesky.bsup ] || bin/super -i json -f bsup -o $d/bluesky.bsup $d/file_0001.json.gz
[ -f $d/bluesky-sansrecord.bsup ] || bin/super -f bsup -o $d/bluesky-sansrecord.bsup -c "drop commit.record" $d/bluesky.bsup
[ -f $d/bluesky-sansrecord.parquet ] || bin/super -f parquet -o $d/bluesky-sansrecord.parquet -c fuse $d/bluesky-sansrecord.bsup

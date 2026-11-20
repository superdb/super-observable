#!/bin/sh
# Télécharge le premier des 100 fichiers de ClickBench (hits_0.parquet, ~1 M de lignes, 105 colonnes plates),
# puis en fait un BSUP typé (textes en string, sans les unions avec null du Parquet d'origine)
# et un Parquet réécrit par super à partir de ce BSUP. Idempotent.
set -eu
cd "$(dirname "$0")/.."
mkdir -p raw/clickbench
d=raw/clickbench
[ -f $d/hits_0.parquet ] || curl -sSf -o $d/hits_0.parquet https://clickhouse-public-datasets.s3.amazonaws.com/hits_compatible/athena_partitioned/hits_0.parquet
[ -f $d/hits.bsup ] || bin/super -f bsup -o $d/hits.bsup -I queries/hits-cast.spq $d/hits_0.parquet
[ -f $d/hits-super.parquet ] || bin/super -f parquet -o $d/hits-super.parquet $d/hits.bsup

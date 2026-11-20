#!/bin/sh
# Télécharge le « GHA Sample » (GitHub Archive, 2023-02-08) utilisé dans les bancs d'essai de SuperDB
# et le convertit en BSUP et en Parquet (fusionné). Idempotent.
set -eu
cd "$(dirname "$0")/.."
mkdir -p raw/gha
[ -f raw/gha/ghasample.json.gz ] || curl -sSf -o raw/gha/ghasample.json.gz https://brim-benchmarks.s3.us-east-2.amazonaws.com/gha/ghasample.json.gz
[ -f raw/gha/ghasample.bsup ] || bin/super -i json -f bsup -o raw/gha/ghasample.bsup raw/gha/ghasample.json.gz
[ -f raw/gha/ghasample.parquet ] || bin/super -c fuse -f parquet -o raw/gha/ghasample.parquet raw/gha/ghasample.bsup

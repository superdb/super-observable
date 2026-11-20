#!/bin/sh
set -eu
scripts/get-gha.sh >&2
node scripts/run-bench.mjs gha | bin/super -i json -f bsup -

#!/bin/sh
set -eu
scripts/get-clickbench.sh >&2
node scripts/run-bench.mjs clickbench | bin/super -i json -f bsup -

#!/bin/sh
set -eu
scripts/get-bluesky.sh >&2
node scripts/run-bench.mjs bluesky | bin/super -i json -f bsup -

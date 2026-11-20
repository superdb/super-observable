#!/bin/sh
set -eu
for d in gha bluesky clickbench; do scripts/get-$d.sh >&2; done
for d in gha bluesky clickbench; do scripts/sizes.sh $d; done | bin/super -i json -f bsup -

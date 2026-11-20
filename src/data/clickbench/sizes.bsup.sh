#!/bin/sh
set -eu
scripts/get-clickbench.sh >&2
scripts/sizes.sh clickbench | bin/super -i json -f bsup -

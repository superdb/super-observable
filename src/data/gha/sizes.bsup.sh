#!/bin/sh
set -eu
scripts/get-gha.sh >&2
scripts/sizes.sh gha | bin/super -i json -f bsup -

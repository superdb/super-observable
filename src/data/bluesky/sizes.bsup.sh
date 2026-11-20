#!/bin/sh
set -eu
scripts/get-bluesky.sh >&2
scripts/sizes.sh bluesky | bin/super -i json -f bsup -

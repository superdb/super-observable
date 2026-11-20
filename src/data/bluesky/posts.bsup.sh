#!/bin/sh
# Round trip through SUP recomputes exact types: otherwise the fused type written in the BSUP frames
# inherits commit.record.text (string|missing) and `values {text}` fails the static check.
set -eu
scripts/get-bluesky.sh >&2
bin/super -dynamic -f sup -I queries/bluesky-posts.spq raw/bluesky/bluesky.bsup | bin/super -i sup -f bsup -

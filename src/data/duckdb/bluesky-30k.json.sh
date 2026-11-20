#!/bin/sh
# The first 30,000 Bluesky events, untouched (newline-delimited JSON): the same bytes for both engines in the browser.
set -eu
scripts/get-bluesky.sh >&2
gzip -dc raw/bluesky/file_0001.json.gz | head -30000

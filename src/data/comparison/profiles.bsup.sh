#!/bin/sh
# Profile of each dataset: rows and distinct top-level shapes.
set -eu
for d in gha bluesky clickbench; do scripts/get-$d.sh >&2; done
p() { bin/super -s -c "aggregate rows:=count(), shapes:=count(distinct typeof(this)) | values {dataset:'$1', ...this}" "$2"; }
{
  p gha raw/gha/ghasample.bsup
  p bluesky raw/bluesky/bluesky.bsup
  p clickbench raw/clickbench/hits.bsup
} | bin/super -f bsup -

#!/bin/sh
# Events per 10-second bucket and collection.
set -eu
scripts/get-bluesky.sh >&2
bin/super -dynamic -f bsup -c "
  aggregate n:=count() by t:=bucket((time_us*1000)::timestamp, 10s), collection:=coalesce(commit.collection, kind)
  | sort t, collection" raw/bluesky/bluesky.bsup

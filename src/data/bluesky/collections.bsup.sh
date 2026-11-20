#!/bin/sh
# Per collection (record type): events, distinct shapes, operations.
set -eu
scripts/get-bluesky.sh >&2
bin/super -dynamic -f bsup -c "
  aggregate n:=count(), shapes:=count(distinct typeof(this)),
    creates:=count() filter (commit.operation=='create'),
    deletes:=count() filter (commit.operation=='delete'),
    updates:=count() filter (commit.operation=='update')
    by collection:=coalesce(commit.collection, kind)
  | sort -r n" raw/bluesky/bluesky.bsup

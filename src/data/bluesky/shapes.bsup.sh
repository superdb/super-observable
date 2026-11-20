#!/bin/sh
# Shapes of created posts: count per distinct type of commit.record, with its field paths.
set -eu
scripts/get-bluesky.sh >&2
bin/super -dynamic -f bsup -c "
  where commit.collection=='app.bsky.feed.post' and commit.operation=='create'
  | aggregate n:=count(), ex:=any(commit.record) by shape:=typeof(commit.record)
  | sort -r n
  | values {n, fields:[unnest flatten(ex) | values regexp_replace(join([unnest path | values this::string], '.'), '[.][0-9]+', '[]') | distinct this]}" raw/bluesky/bluesky.bsup

#!/bin/sh
# One row per event (actor, repo, title, language, labels, assignees…), coalesce for type-specific fields.
set -eu
scripts/get-gha.sh >&2
bin/super -dynamic -f bsup -I queries/gha-events.spq

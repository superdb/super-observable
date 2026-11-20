#!/bin/sh
# One row per hit that carries a search phrase: what the browser loads for the explorer.
set -eu
scripts/get-clickbench.sh >&2
bin/super -f bsup -c "
  where SearchPhrase != ''
  | values {ts: ((EventTime + 14400) * 1000000000)::timestamp, phrase: SearchPhrase, user: UserID,
            region: RegionID, mobile: IsMobile==1, engine: SearchEngineID}" raw/clickbench/hits.bsup

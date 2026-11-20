#!/bin/sh
# ClickBench searches (same rows as clickbench/searches.bsup) as Parquet, DuckDB's native browser format.
set -eu
scripts/get-clickbench.sh >&2
bin/super -f parquet -c "
  where SearchPhrase != ''
  | values {ts: ((EventTime + 14400) * 1000000000)::timestamp, phrase: SearchPhrase, user: UserID,
            region: RegionID, mobile: IsMobile==1, engine: SearchEngineID}" raw/clickbench/hits.bsup

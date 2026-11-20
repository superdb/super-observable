#!/bin/sh
# Population of every municipality (5-digit geographic code) by year, 1986 to today, including
# municipalities that no longer exist (mergers). Other entities (MRCs, boroughs…) are dropped.
set -eu
scripts/get-quebec.sh >&2
bin/super -f bsup -c "
  from 'raw/quebec/population.jsonl'
  | where not grep('[A-Z]', code)
  | aggregate population:=max(population) by code, year
  | sort code, year" 

#!/bin/sh
# Hits per 10 minutes, desktop vs mobile. EventTime is Moscow time (UTC+4 in 2013), shown as is.
set -eu
scripts/get-clickbench.sh >&2
bin/super -f bsup -c "
  aggregate n:=count() by t:=bucket(((EventTime + 14400) * 1000000000)::timestamp, 10m), mobile:=IsMobile==1
  | sort t, mobile" raw/clickbench/hits.bsup

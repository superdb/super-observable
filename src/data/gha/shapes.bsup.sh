#!/bin/sh
# Heterogeneity of the raw data: distinct shapes (types) per event type.
set -eu
scripts/get-gha.sh >&2
bin/super -dynamic -f bsup -c "
from 'raw/gha/ghasample.bsup'
| aggregate n:=count(), shapes:=count(distinct typeof(this)), payload_shapes:=count(distinct typeof(payload)) by type
| sort -r n"

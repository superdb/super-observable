#!/bin/sh
# The 105 columns: type and number of rows holding a non-default value (not 0 or "").
# One pass over 105 M values: about a minute.
set -eu
scripts/get-clickbench.sh >&2
F=raw/clickbench/hits.bsup
{
  bin/super -s -c "head 1 | unnest flatten(this) | values {column: path[0], type: typeof(value)::string, filled: 0}" $F
  bin/super -s -c "unnest flatten(this) | where not (value::string in ['0', '']) | aggregate filled:=count() by column:=path[0]" $F
} | bin/super -f bsup -c "aggregate type:=max(type), filled:=sum(filled) by column | sort -r filled, column" -

#!/bin/sh
# One record per municipality from the MAMH directory, statistical fields only (no names of elected
# officials or contacts), with its population ten years earlier from the population history.
set -eu
scripts/get-quebec.sh >&2
bin/super -f bsup -c "
  from 'raw/quebec/municipalities.csv'
  | values {
      code: mcode < 10000 ? f'0{mcode::int64}' : f'{mcode::int64}',
      name: munnom,
      designation: mdes,
      kind: case mcodedesi::int64
        when 5 then 'municipality' when 10 then 'city' when 4 then 'parish'
        when 1 then 'township' when 2 then 'township' when 6 then 'village'
        when 25 then 'unorganized' when 40 then 'other'
        else 'indigenous' end,
      demonym: mgentile,
      region: replace(regexp_replace(regadm, ' \\\\([0-9]+\\\\)$', ''), '--', '–'),
      region_code: regexp('\\\\(([0-9]+)\\\\)$', regadm)[1],
      mrc: regexp_replace(mrc, ' \\\\([0-9]+\\\\)$', ''),
      founded: mdatcons is null ? null : f'{mdatcons}T00:00:00Z'::timestamp,
      area: msuperf,
      land: msupft,
      population: mpopul::int64,
      divisions: divter
    }
  | left join (
      from 'raw/quebec/population.jsonl'
      | where year = 2016 and not grep('[A-Z]', code)
      | aggregate population_2016:=max(population) by code
    ) as {m, p} on m.code = p.code
  | values {...m, population_2016: p.population_2016}
  | sort -r population, name"

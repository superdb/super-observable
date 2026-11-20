#!/bin/sh
# Simplified boundaries (MRNF, 1:100,000, ~400 m tolerance) as BSUP: municipalities, then regions.
# Each record is {layer, code, name, polygons}, where polygons are MultiPolygon coordinates.
set -eu
scripts/get-quebec.sh >&2
bin/super -f bsup -c "
  fork
    ( from 'raw/quebec/geo/municipalities.geojson' (format json) | unnest features
      | values {layer: 'municipality', code: properties.MUS_CO_GEO, name: null::string, polygons: geometry.coordinates} )
    ( from 'raw/quebec/geo/regions.geojson' (format json) | unnest features
      | values {layer: 'region', code: properties.RES_CO_REG, name: properties.RES_NM_REG, polygons: geometry.coordinates} )
  | sort layer, code"

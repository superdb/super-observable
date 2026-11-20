#!/bin/sh
# Quebec municipalities (open data, Données Québec): MAMH directory, population history and
# MRNF administrative boundaries at 1:100,000, converted into raw/quebec/.
# The directory also lists elected officials and contacts; the loaders keep only statistical fields.
set -e
cd "$(dirname "$0")/.."
D=raw/quebec
mkdir -p $D/shp $D/geo
R=https://donneesouvertes.affmunqc.net/repertoire
# The CSV starts with a UTF-8 BOM. Careful: on macOS MUN.csv and mun.csv are the same file.
[ -s $D/municipalities.csv ] || curl -sSfL $R/MUN.csv | python3 -I -c 'import sys; d = sys.stdin.buffer.read(); sys.stdout.buffer.write(d[3:] if d[:3] == b"\xef\xbb\xbf" else d)' > $D/municipalities.csv
[ -s $D/population.jsonl ] || curl -sSfL $R/A01_CONVERT_XML_POP.xml | python3 -I scripts/quebec_pop.py > $D/population.jsonl
[ -f $D/bdat.zip ] || curl -sSfL -o $D/bdat.zip 'https://diffusion.mern.gouv.qc.ca/diffusion/RGQ/Vectoriel/Theme/Regional/SDA_100k/SHP/BDAT(adm)_SHP.zip'
[ -s $D/geo/regions.geojson ] && exit 0
unzip -o -j -q $D/bdat.zip 'Bdat/SHP/munic_s.*' 'Bdat/SHP/regio_s.*' -d $D/shp
python3 -I scripts/shp2geojson.py $D/shp/munic_s.shp 0.004 MUS_CO_GEO > $D/geo/municipalities.geojson
python3 -I scripts/shp2geojson.py $D/shp/regio_s.shp 0.01 RES_CO_REG,RES_NM_REG > $D/geo/regions.geojson

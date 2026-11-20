#!/usr/bin/env python3
"""MAMH population XML (stdin) → JSON lines {code, year, population, source}."""
import json, sys
import xml.etree.ElementTree as ET

for _, el in ET.iterparse(sys.stdin.buffer):
    if el.tag == "population":
        g = {c.tag: (c.text or "").strip() for c in el}
        print(json.dumps({"code": g["COD_GEO_N"], "year": int(g["AN_ENTR"]), "population": int(g["POP"] or 0), "source": g["D_ORG_PROD"]}, ensure_ascii=False))
        el.clear()

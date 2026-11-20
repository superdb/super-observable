#!/bin/sh
# Arrow ne supporte pas plusieurs types : on doit fusionner en un schéma unique.
exec bin/super -f arrows -c "from 'raw/events.json' | values {...this, ts:ts::timestamp} | fuse"

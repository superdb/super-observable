#!/bin/sh
exec bin/super -f bsup -c "from 'raw/events.json' | values {...this, ts:ts::timestamp}"

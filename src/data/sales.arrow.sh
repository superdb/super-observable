#!/bin/sh
# Converti au build par Observable Framework (cwd = racine du projet).
exec bin/super -f arrows -c "from 'raw/sales.json' | values {id,date:date::timestamp,region,customer,sku,quantity,price:price::float64,amount:amount::float64}"

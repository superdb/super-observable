#!/bin/sh
# Compile src/lib/super.wasm sans Arrow/Parquet ni S3 (balises noarrow,nos3).
# Le patch super-wasm.patch place ces formats derrière des balises de compilation ;
# il est appliqué à une copie du module super dans .super-src (voir le replace de go.mod).
set -eu
cd "$(dirname "$0")"
VER=$(go mod edit -json | python3 -c 'import json,sys; print([r["Version"] for r in json.load(sys.stdin)["Require"] if r["Path"]=="github.com/superdb/super"][0])')
if [ "$(cat .super-src/.version 2>/dev/null)" != "$VER" ]; then
  DIR=$(GOFLAGS=-mod=mod go mod download -json "github.com/superdb/super@$VER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["Dir"])')
  rm -rf .super-src
  cp -R "$DIR" .super-src
  chmod -R u+w .super-src
  patch -s -p1 -d .super-src < super-wasm.patch
  echo "$VER" > .super-src/.version
fi
GOOS=js GOARCH=wasm go build -tags noarrow,nos3 -trimpath -ldflags="-s -w -X main.version=$VER" -o ../src/lib/super.wasm .
install -m 644 "$(go env GOROOT)/lib/wasm/wasm_exec.js" ../src/lib/
ls -lh ../src/lib/super.wasm

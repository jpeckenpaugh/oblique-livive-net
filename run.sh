#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
echo "Starting Model Sandbox HTTP server on http://localhost:8282"
python3 -m http.server 8282 --bind 127.0.0.1 --directory "$SCRIPT_DIR"

#!/usr/bin/env sh
cd "$(dirname "$0")"
printf 'Open http://localhost:8080\n'
python3 -m http.server 8080

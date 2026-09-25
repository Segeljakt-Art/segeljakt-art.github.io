#!/bin/sh
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 saknas. Installera det från https://www.python.org/downloads/macos/"
  printf "Tryck Enter för att stänga..."
  read -r _
  exit 1
fi
exec python3 _manager/server.py

#!/usr/bin/env bash
# Spike C test runner. stdlib python3 only - no npm, no UI framework.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 -m unittest discover -s tests -p 'test_*.py' -t tests -v "$@"

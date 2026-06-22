#!/usr/bin/env bash
set -euo pipefail
node dist/cli.js init test/fixtures/actions --out tmp/policy-cases.json
node dist/cli.js validate tmp/policy-cases.json
node dist/cli.js matrix tmp/policy-cases.json --format markdown > tmp/policy-matrix.md

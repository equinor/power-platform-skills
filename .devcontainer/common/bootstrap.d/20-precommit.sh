#!/usr/bin/env bash
# 20-precommit.sh — install this repo's pre-commit hooks.
#
# Runs with the workspace folder as cwd (inherited from post-create.sh).
# Idempotent: `pre-commit install` is safe to re-run on rebuilds.
#
# Skips if pre-commit is not installed (unexpected in the provided base
# images, but keeps the fragment robust) or if the repo has no
# .pre-commit-config.yaml (template consumers may opt out).
#
# Sourced from common-bootstrap.sh — use `return`, never `exit`.

_appsec_precommit_bootstrap() {
  set -euo pipefail

  if ! command -v pre-commit >/dev/null 2>&1; then
    echo "pre-commit not found on PATH — skipping hook install"
    return 0
  fi

  if [[ ! -f .pre-commit-config.yaml ]]; then
    echo "No .pre-commit-config.yaml in $(pwd) — skipping hook install"
    return 0
  fi

  echo "Installing pre-commit hooks in $(pwd)"
  pre-commit install
}

_appsec_precommit_bootstrap
unset -f _appsec_precommit_bootstrap

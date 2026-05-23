#!/usr/bin/env bash
# common-bootstrap.sh — orchestrator for shared post-create bootstrap fragments.
#
# Each fragment under .devcontainer/common/bootstrap.d/*.sh is source'd in
# lexical (numeric-prefix) order. Conventions for fragments:
#   - Wrap logic in a uniquely named function, invoke it, then `unset -f`.
#   - Use `return` for early exits; this file is source'd from post-create.sh.
#   - Be idempotent — post-create can run again on rebuilds.
#
# This file itself is source'd from each stack's post-create.sh; the single
# entry point stays stable so per-stack configs don't need to change when
# fragments are added or reordered.

set -euo pipefail

_APPSEC_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

shopt -s nullglob
for _appsec_fragment in "${_APPSEC_COMMON_DIR}/bootstrap.d"/*.sh; do
  echo "==> sourcing $(basename "${_appsec_fragment}")"
  # shellcheck source=/dev/null
  source "${_appsec_fragment}"
done
shopt -u nullglob

unset _appsec_fragment _APPSEC_COMMON_DIR

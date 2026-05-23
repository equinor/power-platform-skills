#!/usr/bin/env bash
# 30-zshrc.sh — write baseline ~/.zshrc entries for the vscode user.
#
# Appends lines that must be present for the shell environment to work
# correctly. Each line is guarded by a grep check so this fragment is
# idempotent across rebuilds.
#
# Sourced from common-bootstrap.sh — use `return`, never `exit`.

_appsec_zshrc_bootstrap() {
  set -euo pipefail

  local zshrc="${HOME}/.zshrc"

  # Initialise the Starship prompt. Must be present in .zshrc rather than
  # .zsh_profile because VS Code opens non-login interactive shells, so only
  # .zshrc is sourced. Without this line the prompt silently falls back to the
  # plain zsh default even though starship is installed.
  if ! grep -qxF 'eval "$(starship init zsh)"' "${zshrc}" 2>/dev/null; then
    echo 'eval "$(starship init zsh)"' >> "${zshrc}"
    echo "Added 'starship init zsh' to ${zshrc}"
  else
    echo "starship init already present in ${zshrc} — skipping"
  fi
}

_appsec_zshrc_bootstrap
unset -f _appsec_zshrc_bootstrap

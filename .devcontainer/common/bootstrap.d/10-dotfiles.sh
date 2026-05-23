#!/usr/bin/env bash
# 10-dotfiles.sh — clone personal dotfiles and run their install.sh.
#
# Tool-agnostic: any manager-specific logic (chezmoi, stow, yadm, …) is the
# responsibility of the user's own install.sh.
#
# Behavior:
#   - In Codespaces: do nothing (handled by GitHub user settings,
#     https://github.com/settings/codespaces).
#   - If $HOME/dotfiles already exists: do nothing (Dev Containers
#     extension's dotfiles feature or a previous run handled it).
#   - Otherwise, if GITHUB_USER (or DOTFILES_REPO_URL) is set, clone into
#     $HOME/dotfiles over HTTPS and run install.sh.
#
# Overrides:
#   - DOTFILES_REPO_URL: full clone URL, overrides the GITHUB_USER-derived
#     default. Useful for forks or non-GitHub hosts.
#
# Sourced from common-bootstrap.sh — use `return`, never `exit`.

_appsec_dotfiles_bootstrap() {
  set -euo pipefail

  local dotfiles_dir="${HOME}/dotfiles"

  if [[ -n "${CODESPACES:-}" ]]; then
    echo "Codespaces detected — skipping dotfiles bootstrap (handled by GitHub settings)"
    return 0
  fi

  if [[ -d "${dotfiles_dir}" ]]; then
    echo "${dotfiles_dir} already exists — skipping dotfiles bootstrap (assumed handled by Dev Containers extension or a previous run)"
    return 0
  fi

  local repo_url="${DOTFILES_REPO_URL:-}"
  if [[ -z "${repo_url}" ]]; then
    if [[ -z "${GITHUB_USER:-}" ]]; then
      echo "GITHUB_USER not set — skipping dotfiles bootstrap"
      return 0
    fi
    repo_url="https://github.com/${GITHUB_USER}/dotfiles.git"
  fi

  if ! command -v git >/dev/null 2>&1; then
    echo "git not found on PATH — cannot bootstrap dotfiles" >&2
    return 1
  fi

  echo "Cloning dotfiles from ${repo_url} into ${dotfiles_dir}"
  git clone "${repo_url}" "${dotfiles_dir}"

  local install_script="${dotfiles_dir}/install.sh"
  if [[ -x "${install_script}" ]]; then
    echo "Running ${install_script}"
    ( cd "${dotfiles_dir}" && ./install.sh )
  elif [[ -f "${install_script}" ]]; then
    echo "Running ${install_script} via bash (not executable)"
    ( cd "${dotfiles_dir}" && bash ./install.sh )
  else
    echo "No install.sh found in ${dotfiles_dir} — nothing to run" >&2
  fi
}

_appsec_dotfiles_bootstrap
unset -f _appsec_dotfiles_bootstrap

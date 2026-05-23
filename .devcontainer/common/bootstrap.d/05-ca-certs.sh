#!/usr/bin/env bash
# 05-ca-certs.sh — inject Equinor CAs into Python certifi at post-create time.
#
# CONTEXT
# Equinor's corporate network performs SSL inspection: a proxy intercepts TLS
# connections and presents replacement certificates signed by an Equinor CA.
# Three independent layers must be configured for everything to work:
#
#   1. System CA trust            — handled in the Dockerfile (debian target of
#                                   the install-equinor-certificates.sh script).
#                                   Covers curl, git, apt, openssl, Node.js via
#                                   NODE_EXTRA_CA_CERTS, pip via REQUESTS_CA_BUNDLE.
#
#   2. Python ssl module strict   — handled in the Dockerfile (sitecustomize.py).
#      verification flags          The Equinor proxy's leaf certificates lack the
#                                   X.509 Authority Key Identifier extension,
#                                   which OpenSSL 3.x / Python 3.12+ reject by
#                                   default. sitecustomize.py disables the strict
#                                   flag for the entire Python process.
#
#   3. certifi bundle             — handled HERE at post-create time.
#                                   certifi ships its own CA bundle independent
#                                   of the OS. Some libraries (httpx, parts of
#                                   requests) consult it directly and ignore
#                                   REQUESTS_CA_BUNDLE, so the Equinor CAs must
#                                   be appended to its file. Doing this in the
#                                   bootstrap (rather than the Dockerfile) keeps
#                                   it correct even if certifi is reinstalled
#                                   inside the running container.
#
# DETECTION STRATEGY
# We probe a non-whitelisted public host with `openssl s_client` and inspect
# the verified chain it prints (the `depth=` lines). On a clean network the
# top-of-chain root will be a public CA (DigiCert, ISRG, etc.); on the Equinor
# corporate network the proxy substitutes the chain so the root is an Equinor
# CA. We match a stable substring ("Equinor") in the highest-depth line.
#
# Well-known hosts like github.com and microsoft.com are routinely whitelisted
# (TLS passthrough), so they look identical on both networks and are useless
# as probes. We pick hosts that are unlikely to be on any whitelist (Norwegian
# news, infrastructure orgs) and try several so that a single host being
# unreachable does not cause a false negative.
#
# CODESPACES
# Codespaces runs on GitHub infrastructure with no SSL inspection, so this
# fragment is a no-op there.
#
# Sourced from common-bootstrap.sh — use `return`, never `exit`.

# Returns 0 if the TLS chain to a probe host is rooted in an Equinor CA
# (i.e. SSL inspection is in effect), 1 otherwise. Network/DNS failures on
# individual hosts are skipped; if no host is reachable we return 1 (assume
# clean) so we don't inject CAs on broken networks.
_appsec_ssl_inspection_detected() {
  local probe_hosts=(vg.no www.nrk.no www.iana.org)
  local marker="Equinor"
  local host root

  for host in "${probe_hosts[@]}"; do
    # NOTE: openssl prints `depth=` lines from its verification callback to
    # stderr, while the cert chain dump goes to stdout. We need 2>&1 (not
    # 2>/dev/null) so the depth lines reach the grep.
    root=$(timeout 5 bash -c "echo | openssl s_client -connect ${host}:443 -servername ${host} 2>&1" \
           | grep '^depth=' | sort -rn | head -1)
    [[ -z "${root}" ]] && continue
    [[ "${root}" == *"${marker}"* ]] && return 0
    return 1
  done
  return 1
}

_appsec_ca_certs_bootstrap() {
  set -euo pipefail

  if [[ -n "${CODESPACES:-}" ]]; then
    echo "Codespaces detected — skipping CA certificate bootstrap"
    return 0
  fi

  local script="/usr/local/share/equinor/install-equinor-certificates.sh"

  if [[ ! -f "${script}" ]]; then
    echo "WARNING: ${script} not found — was the image built from this template's Dockerfile?" >&2
    return 0
  fi

  if ! _appsec_ssl_inspection_detected; then
    echo "No SSL inspection detected on probe hosts — skipping certifi CA injection"
    return 0
  fi
  echo "SSL inspection detected — injecting Equinor CAs into Python certifi bundle"

  # --- Python certifi ---
  # certifi ships its own CA bundle. Inject the Equinor CAs directly so that
  # requests, httpx, pip and other tools that resolve certifi independently of
  # REQUESTS_CA_BUNDLE work correctly on SSL-inspecting corporate networks.
  #
  # We avoid the install script's `python` target because it resolves
  # site-packages via sysconfig, which returns the system path even when certifi
  # is installed in the user's ~/.local. Instead we ask Python directly where
  # certifi's bundle lives and pipe the PEM output from the `file -` target to it.
  if python3 -m certifi > /dev/null 2>&1; then
    local certifi_bundle
    certifi_bundle=$(python3 -c "import certifi; print(certifi.where())")
    echo "Installing Equinor CA certificates into certifi bundle at ${certifi_bundle} ..."
    # certifi may be in a system path (root-owned) or user path; use sudo tee -a
    # so the append works in both cases. The redirect itself runs as the user,
    # so a plain `sudo cmd >> file` would not have privileges.
    if ! "${script}" --silent file - | sudo tee -a "${certifi_bundle}" > /dev/null; then
      echo "WARNING: CA certificate installation (python certifi) failed — continuing without it" >&2
    fi
  fi
}

_appsec_ca_certs_bootstrap
unset -f _appsec_ca_certs_bootstrap
unset -f _appsec_ssl_inspection_detected

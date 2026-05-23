#!/bin/bash
# post-create.sh — devcontainer post-create hook (Node GHCR)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -d "$SCRIPT_DIR/common" ]; then
  git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/equinor/appsec-devcontainer-template.git /tmp/appsec-template
  cd /tmp/appsec-template && git sparse-checkout set .devcontainer/common
  cp -r /tmp/appsec-template/.devcontainer/common "$SCRIPT_DIR/common"
  rm -rf /tmp/appsec-template
fi
source "$SCRIPT_DIR/common/common-bootstrap.sh"

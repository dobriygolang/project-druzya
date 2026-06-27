#!/usr/bin/env bash
# One-time server setup before GitHub Actions deploy can run.
# Usage (on the VPS as deploy user):
#   curl -fsSL .../bootstrap-server.sh | bash -s -- \
#     git@github.com:YOUR_ORG/project-druzya.git
#
# Or:
#   ./scripts/bootstrap-server.sh git@github.com:YOUR_ORG/project-druzya.git
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/project-druzya}"
GIT_URL="${1:-}"
BRANCH="${BRANCH:-main}"

if [ -z "$GIT_URL" ]; then
  echo "Usage: $0 <git-clone-url>"
  echo "Example: $0 git@github.com:your-org/project-druzya.git"
  exit 1
fi

if [ -d "$REPO_DIR/.git" ]; then
  echo "Already bootstrapped: $REPO_DIR"
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose v2 required"
  exit 1
fi

PARENT="$(dirname "$REPO_DIR")"
if [ ! -d "$PARENT" ]; then
  sudo mkdir -p "$PARENT"
  sudo chown "$(whoami):$(id -gn)" "$PARENT"
fi

echo "Cloning $GIT_URL -> $REPO_DIR (branch $BRANCH)..."
git clone --branch "$BRANCH" "$GIT_URL" "$REPO_DIR"

cd "$REPO_DIR/deploy"
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Created deploy/.env — edit secrets before first start:"
  echo "  nano $REPO_DIR/deploy/.env"
fi

make keys

cat <<EOF

Bootstrap done.

Next on the server:
  1. nano $REPO_DIR/deploy/.env    # fill secrets (see PRODUCTION_CHECKLIST.md)
  2. cd $REPO_DIR/deploy && make up

GitHub Actions deploy expects:
  DEPLOY_REPO_DIR=$REPO_DIR  (optional secret, this is the default)
  SSH user must be able to: cd $REPO_DIR && git pull && docker compose ...

EOF

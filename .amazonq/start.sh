#!/usr/bin/env bash
set -e

ENV_FILE="$(dirname "$0")/../.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: .env.local not found at $ENV_FILE"
  echo "Create it from .env.local.example or restore from Codespace secrets."
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

exec q chat --agent mighty-verse "$@"

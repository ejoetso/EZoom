#!/bin/sh
set -eu

cd "$(dirname "$0")/../../.."

if [ -z "${VITE_EZOOM_API_URL:-}" ]; then
  echo "Set VITE_EZOOM_API_URL to the deployed HTTPS EZoom service in the Xcode Cloud workflow." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  if ! command -v brew >/dev/null 2>&1; then
    echo "Node.js 22 or later is required to prepare the EZoom web assets." >&2
    exit 1
  fi
  brew install node@22
  PATH="$(brew --prefix node@22)/bin:$PATH"
  export PATH
fi

npm ci
npm run lint
npm run build
npx cap sync ios
npm run ios:check

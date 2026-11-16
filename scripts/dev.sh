#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
build_dir=$(mktemp -d)
pids=()

cleanup() {
    if (( ${#pids[@]} )); then
        kill "${pids[@]}" 2>/dev/null || true
        wait "${pids[@]}" 2>/dev/null || true
    fi
    rm -rf "$build_dir"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for app in frontend librarian; do
    if [[ ! -x "$app/node_modules/.bin/vite" ]]; then
        echo "Run npm ci in $app first." >&2
        exit 1
    fi
done

(cd backend/library-service && go build -o "$build_dir/library-service" ./cmd)
(cd backend/api-gateway && go build -o "$build_dir/api-gateway" .)

(cd backend/library-service && exec "$build_dir/library-service") &
pids+=("$!")
(cd backend/api-gateway && exec "$build_dir/api-gateway") &
pids+=("$!")
(cd frontend && exec ./node_modules/.bin/vite --port 5173 --strictPort) &
pids+=("$!")
(cd librarian && exec ./node_modules/.bin/vite --port 5174 --strictPort) &
pids+=("$!")

wait -n "${pids[@]}"

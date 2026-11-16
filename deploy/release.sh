#!/usr/bin/env bash
set -euo pipefail
umask 077

release_dir=$(cd "$(dirname "$0")" && pwd -P)
release=$(basename "$release_dir")
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || { echo "Unexpected release directory" >&2; exit 1; }
root=$(dirname "$(dirname "$release_dir")")
cd "$release_dir"
export IMAGE_TAG="$release"

docker load --input images.tar.gz
compose=(docker compose --env-file .env -f compose.yaml)
"${compose[@]}" config --quiet
if ! "${compose[@]}" up -d --no-build --pull never --wait --wait-timeout 180; then
  "${compose[@]}" ps -a
  exit 1
fi

ln -sfn "$release_dir" "$root/current"
rm images.tar.gz
printf 'Deployed library release %s\n' "$release"

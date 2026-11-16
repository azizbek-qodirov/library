#!/bin/sh
set -eu

cd "$(dirname "$0")"
output=$(mktemp -d)
trap 'rm -rf "$output"' EXIT
protoc --go_out="$output" --go-grpc_out="$output" library_submodule/*.proto
for module in api-gateway library-service; do
    cp "$output"/internal/pkg/genproto/*.go "../$module/internal/pkg/genproto/"
done

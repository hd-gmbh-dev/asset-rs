#!/bin/bash

cargo set-version --workspace $1
cargo build
npm version $1 --include-workspace-root -ws --no-git-tag-version --allow-same-version --no-workspaces-update
pnpm i
pnpm build

git add .
git commit -m "build: prepare release v$1" --no-verify
git push
# git tag v$1
# git push -u origin v$1

pnpm publish --recursive --access public --no-git-checks
cargo publish -p ars-package
cargo publish -p ars-server

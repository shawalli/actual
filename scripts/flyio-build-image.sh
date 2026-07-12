#!/usr/bin/env zsh

set -euo pipefail

ORIGIN_REMOTE="origin"

# Usage:
#   ./scripts/flyio-build-image.sh                # Build for the latest fork tag
#   ./scripts/flyio-build-image.sh --tag vX.Y.Z.N

if [[ $# -gt 2 ]]; then
  echo "Usage: $0 [--tag vX.Y.Z.N]"
  exit 1
fi

TARGET_TAG=""
if [[ $# -gt 0 ]]; then
  if [[ "$1" != "--tag" || $# -ne 2 ]]; then
    echo "Usage: $0 [--tag vX.Y.Z.N]"
    exit 1
  fi

  TARGET_TAG="$2"
fi

# Read Fly.io app name from fly.toml (gitignored)
if [ -f fly.toml ]; then
  FLY_APP=$(grep '^app' fly.toml | cut -d'"' -f2)
  if [ -z "$FLY_APP" ]; then
    echo "Error: Could not find app name in fly.toml"
    exit 1
  fi
else
  echo "Error: fly.toml file not found."
  exit 1
fi

if [[ -z "$TARGET_TAG" ]]; then
  TARGET_TAG=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1)
fi

if [[ -z "$TARGET_TAG" ]]; then
  echo "Error: No fork release tag found. Pass one with --tag."
  exit 1
fi

if ! echo "$TARGET_TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Tag must match vX.Y.Z.N. Received: ${TARGET_TAG}"
  exit 1
fi

if [[ -z $(git ls-remote --tags "$ORIGIN_REMOTE" "$TARGET_TAG") ]]; then
  echo "Error: Tag ${TARGET_TAG} was not found on ${ORIGIN_REMOTE}. Push and verify the tag before building the image."
  exit 1
fi

echo "Using release tag ${TARGET_TAG}"

echo "Building application..."
yarn build:server

docker build \
  --platform linux/amd64 \
  -f packages/sync-server/docker/ubuntu.Dockerfile \
  -t registry.fly.io/${FLY_APP}:${TARGET_TAG} \
  -t registry.fly.io/${FLY_APP}:latest \
  .

echo "Successfully built image: registry.fly.io/${FLY_APP} for tags: ${TARGET_TAG} // latest"

fly auth docker

docker push registry.fly.io/${FLY_APP}:${TARGET_TAG}
echo "Successfully pushed private image: registry.fly.io/${FLY_APP}:${TARGET_TAG}"

docker push registry.fly.io/${FLY_APP}:latest
echo "Successfully pushed private image: registry.fly.io/${FLY_APP}:latest"

#!/usr/bin/env zsh

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

# Auto-find the latest upstream tag matching v.MM.m.p pattern (e.g., v26.2.2)
UPSTREAM_VERSION=$(git tag --sort=-version:refname | grep -E '^v[0-9]{2}\.[0-9]\.[0-9]+$' | head -1 | sed 's/^v//')

# Find the latest fork tag with a 4th segment for this upstream version
# Pattern: 26.2.2.1, 26.2.2.2, etc. (with or without 'v' prefix)
LATEST_FORK_TAG=$(git tag --sort=-version:refname | grep -E "^v?${UPSTREAM_VERSION}\.[0-9]+$" | head -1)

if [ -n "$LATEST_FORK_TAG" ]; then
  # Extract the 4th segment and increment it
  FOURTH_SEGMENT=$(echo "$LATEST_FORK_TAG" | sed 's/^v//' | awk -F. '{print $4}')
  NEXT_SEGMENT=$((FOURTH_SEGMENT + 1))
  NEW_FORK_TAG="${UPSTREAM_VERSION}.${NEXT_SEGMENT}"
else
  # No fork tags exist yet, start at .1
  NEW_FORK_TAG="${UPSTREAM_VERSION}.1"
fi

echo "Building application..."
yarn build:server || { echo "Error: yarn build:server failed"; exit 1; }

docker build \
  --platform linux/amd64 \
  -f packages/sync-server/docker/ubuntu.Dockerfile \
  -t registry.fly.io/${FLY_APP}:${NEW_FORK_TAG} \
  -t registry.fly.io/${FLY_APP}:latest \
  . && echo "Successfully built image: registry.fly.io/${FLY_APP} for tags: ${NEW_FORK_TAG} // latest"

fly auth docker

docker push registry.fly.io/${FLY_APP}:${NEW_FORK_TAG} && \
  echo "Successfully pushed private image: registry.fly.io/${FLY_APP}:${NEW_FORK_TAG}"

docker push registry.fly.io/${FLY_APP}:latest && \
  echo "Successfully pushed private image: registry.fly.io/${FLY_APP}:latest"

read "Do you want to tag and push to GitHub? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
  git tag "${NEW_FORK_TAG}" && \
    echo "Successfully tagged ${NEW_FORK_TAG}"

  git push origin "${NEW_FORK_TAG}" && \
    echo "Successfully pushed tag ${NEW_FORK_TAG} to remote repository"
fi

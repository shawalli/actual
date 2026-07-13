#!/usr/bin/env zsh

# release-fork.sh - Tag and release the fork from fork/master.
#
# Sync release:
#   - Tags fork/master as vX.Y.Z.0 for the latest upstream vX.Y.Z tag
#   - Pushes and verifies the tag
#   - Builds and pushes the Fly.io image for that tag
#
# Feature release:
#   - Tags fork/master as the next vX.Y.Z.N fork tag
#   - Pushes and verifies the tag
#   - Stops so the GitHub Release can be created manually
#
# Usage:
#   ./scripts/release-fork.sh sync
#   ./scripts/release-fork.sh feature

set -euo pipefail

FORK_BRANCH="fork/master"
ORIGIN_REMOTE="origin"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

fail() {
    echo "Error: $1" >&2
    exit 1
}

strip_v_prefix() {
    echo "$1" | sed 's/^v//'
}

latest_upstream_tag() {
    git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1
}

latest_fork_tag() {
    git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -1
}

ensure_clean_worktree() {
    if [[ -n $(git status --porcelain) ]]; then
        fail "Working tree is not clean. Please commit or stash changes."
    fi
}

ensure_tools() {
    command_exists git || fail "git is required but not installed."
    command_exists yarn || fail "yarn is required but not installed."
    command_exists docker || fail "docker is required but not installed."
    command_exists fly || fail "fly is required but not installed."
}

checkout_and_update_fork_master() {
    git checkout "$FORK_BRANCH" >/dev/null 2>&1 || fail "Could not checkout ${FORK_BRANCH}."
    echo "Pulling latest ${FORK_BRANCH}..."
    git pull "$ORIGIN_REMOTE" "$FORK_BRANCH"
}

ensure_tag_missing() {
    local tag="$1"

    if git rev-parse "$tag" >/dev/null 2>&1; then
        fail "Tag ${tag} already exists locally."
    fi
}

push_and_verify_tag() {
    local tag="$1"

    echo "Pushing ${tag} to ${ORIGIN_REMOTE}..."
    git push "$ORIGIN_REMOTE" "$tag"

    echo "Verifying ${tag} on ${ORIGIN_REMOTE}..."
    if [[ -z $(git ls-remote --tags "$ORIGIN_REMOTE" "$tag") ]]; then
        fail "Tag ${tag} was pushed but not found on ${ORIGIN_REMOTE}."
    fi
}

create_sync_tag() {
    local upstream_tag
    local upstream_version
    local sync_tag

    upstream_tag=$(latest_upstream_tag)
    [[ -n "$upstream_tag" ]] || fail "No upstream release tags found."

    upstream_version=$(strip_v_prefix "$upstream_tag")
    sync_tag="v${upstream_version}.0"

    echo "Latest upstream release: ${upstream_tag}"
    echo "Sync release tag:       ${sync_tag}"

    ensure_tag_missing "$sync_tag"

    echo "Creating tag ${sync_tag}..."
    git tag -a "$sync_tag" -m "Sync: upstream ${upstream_tag}"

    push_and_verify_tag "$sync_tag"

    echo ""
    echo "Building Fly.io image for ${sync_tag}..."
    ./scripts/flyio-build-image.sh --tag "$sync_tag"
}

create_feature_tag() {
    local latest_tag
    local base_version
    local patch_segment
    local next_tag

    latest_tag=$(latest_fork_tag)
    [[ -n "$latest_tag" ]] || fail "No fork release tags found. Create a sync release first."

    base_version=$(strip_v_prefix "$latest_tag")
    patch_segment=$(echo "$base_version" | awk -F. '{print $4}')
    next_tag="v$(echo "$base_version" | awk -F. '{printf "%s.%s.%s.%s", $1, $2, $3, $4 + 1}')"

    echo "Latest fork release: ${latest_tag}"
    echo "Feature release tag: ${next_tag}"

    [[ -n "$patch_segment" ]] || fail "Latest fork tag ${latest_tag} is missing a fourth segment."

    ensure_tag_missing "$next_tag"

    echo "Creating tag ${next_tag}..."
    git tag -a "$next_tag" -m "Release: ${next_tag}"

    push_and_verify_tag "$next_tag"

    echo ""
    echo "Tag pushed successfully."
    echo "Next steps:"
    echo "  1. Create the GitHub Release for ${next_tag} manually."
    echo "  2. Run: ./scripts/flyio-build-image.sh --tag ${next_tag}"
}

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <sync|feature>"
    exit 1
fi

MODE="$1"

ensure_tools
ensure_clean_worktree
checkout_and_update_fork_master

case "$MODE" in
    sync)
        create_sync_tag
        ;;
    feature)
        create_feature_tag
        ;;
    *)
        echo "Usage: $0 <sync|feature>"
        exit 1
        ;;
esac

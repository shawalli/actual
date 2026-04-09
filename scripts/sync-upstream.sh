#!/usr/bin/env zsh

# sync-upstream.sh - Deterministically sync upstream actualbudget/actual releases to fork/master
#
# Two-phase workflow:
#   Phase 1 (default): Create release branch from latest upstream tag, merge fork/master into it, create PR
#   Phase 2 (--finalize): After PR is merged, tag fork/master with vX.Y.Z.0 and push the tag
#
# Usage:
#   ./scripts/sync-upstream.sh              # Phase 1: Create release branch and PR
#   ./scripts/sync-upstream.sh --finalize   # Phase 2: Tag fork/master after PR merge

set -e

# Configuration
FORK_BRANCH="fork/master"
UPSTREAM_REMOTE="upstream"
ORIGIN_REMOTE="origin"

# Parse arguments
FINALIZE=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --finalize)
            FINALIZE=true
            shift
            ;;
        *)
            echo "Usage: $0 [--finalize]"
            echo ""
            echo "Phase 1 (default): Create release branch from latest upstream tag and PR to fork/master"
            echo "Phase 2 (--finalize): After PR is merged, tag fork/master with vX.Y.Z.0"
            exit 1
            ;;
    esac
done

# Helper: Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required tools
if ! command_exists git; then
    echo "Error: git is required but not installed."
    exit 1
fi

if ! command_exists gh; then
    echo "Error: gh (GitHub CLI) is required but not installed."
    echo "Install from: https://cli.github.com"
    exit 1
fi

# Helper: Extract version components
extract_upstream_version() {
    local tag="$1"
    # Input: v26.3.0, Output: 26.3.0
    echo "$tag" | sed 's/^v//'
}

if [[ "$FINALIZE" == true ]]; then
    # ===== PHASE 2: Finalize tagging =====

    echo "🏷️  Phase 2: Finalizing upstream sync (tagging fork/master)"
    echo ""

    # Ensure working tree is clean
    if [[ -n $(git status --porcelain) ]]; then
        echo "Error: Working tree is not clean. Please commit or stash changes."
        exit 1
    fi

    # Find the latest upstream release tag (format: vX.Y.Z without 4th segment)
    LATEST_UPSTREAM_TAG=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)

    if [[ -z "$LATEST_UPSTREAM_TAG" ]]; then
        echo "Error: No upstream release tags found."
        exit 1
    fi

    UPSTREAM_VERSION=$(extract_upstream_version "$LATEST_UPSTREAM_TAG")
    FORK_SYNC_TAG="v${UPSTREAM_VERSION}.0"

    echo "Latest upstream release: ${LATEST_UPSTREAM_TAG}"
    echo "Fork sync tag:          ${FORK_SYNC_TAG}"
    echo ""

    # Check if sync tag already exists
    if git tag | grep -q "^${FORK_SYNC_TAG}$"; then
        echo "✓ Tag ${FORK_SYNC_TAG} already exists. Sync is complete."
        exit 0
    fi

    # Ensure we're on fork/master and up to date
    git checkout "$FORK_BRANCH" 2>/dev/null || (echo "Error: Could not checkout ${FORK_BRANCH}"; exit 1)

    echo "Pulling latest ${FORK_BRANCH}..."
    git pull "$ORIGIN_REMOTE" "$FORK_BRANCH"

    # Create annotated tag
    echo ""
    echo "Creating tag ${FORK_SYNC_TAG}..."
    git tag -a "$FORK_SYNC_TAG" -m "Sync: upstream ${LATEST_UPSTREAM_TAG}"

    # Prompt to push
    echo ""
    read -r "PUSH?Push tag to ${ORIGIN_REMOTE}? [y/N] " -t 10

    if [[ "$PUSH" == "y" || "$PUSH" == "Y" ]]; then
        git push "$ORIGIN_REMOTE" "$FORK_SYNC_TAG"
        echo ""
        echo "✓ Tag ${FORK_SYNC_TAG} pushed to ${ORIGIN_REMOTE}."
        echo ""
        echo "Sync complete! Next steps:"
        echo "  - Run './scripts/flyio-build-image.sh' to build and tag a fork release"
        echo "  - Or run './scripts/sync-upstream.sh' again to sync another upstream release"
    else
        echo ""
        echo "Tag created locally but not pushed. To push manually:"
        echo "  git push ${ORIGIN_REMOTE} ${FORK_SYNC_TAG}"
    fi

else
    # ===== PHASE 1: Create release branch and PR =====

    echo "🔄 Phase 1: Syncing latest upstream release"
    echo ""

    # Ensure working tree is clean
    if [[ -n $(git status --porcelain) ]]; then
        echo "Error: Working tree is not clean. Please commit or stash changes."
        exit 1
    fi

    # Fetch upstream tags
    echo "Fetching from ${UPSTREAM_REMOTE}..."
    git fetch "$UPSTREAM_REMOTE" --tags

    # Find latest upstream release tag (format: vX.Y.Z without 4th segment)
    LATEST_UPSTREAM_TAG=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -1)

    if [[ -z "$LATEST_UPSTREAM_TAG" ]]; then
        echo "Error: No upstream release tags found."
        exit 1
    fi

    UPSTREAM_VERSION=$(extract_upstream_version "$LATEST_UPSTREAM_TAG")
    FORK_SYNC_TAG="v${UPSTREAM_VERSION}.0"
    RELEASE_BRANCH="release/${LATEST_UPSTREAM_TAG}"

    echo "Latest upstream release: ${LATEST_UPSTREAM_TAG}"
    echo "Fork branch:             ${FORK_BRANCH}"
    echo "Release branch:          ${RELEASE_BRANCH}"
    echo "Target sync tag:         ${FORK_SYNC_TAG}"
    echo ""

    # Check if already synced
    if git tag | grep -q "^${FORK_SYNC_TAG}$"; then
        echo "✓ Already synced at ${LATEST_UPSTREAM_TAG} (tagged as ${FORK_SYNC_TAG})"
        echo ""
        echo "To sync a different upstream release, fetch more tags:"
        echo "  git fetch ${UPSTREAM_REMOTE} --tags"
        exit 0
    fi

    # Create or checkout release branch
    if git branch --list | grep -q "^${RELEASE_BRANCH}$"; then
        echo "Release branch ${RELEASE_BRANCH} already exists. Checking out..."
        git checkout "$RELEASE_BRANCH"
    else
        echo "Creating release branch from ${LATEST_UPSTREAM_TAG}..."
        git checkout -b "$RELEASE_BRANCH" "$LATEST_UPSTREAM_TAG"
    fi

    # Merge fork/master into release branch
    echo "Merging ${FORK_BRANCH} into ${RELEASE_BRANCH}..."
    echo "(This brings fork customizations on top of the upstream release)"
    echo ""

    if git merge "$FORK_BRANCH" --no-ff -m "sync: upstream ${LATEST_UPSTREAM_TAG}"; then
        echo "✓ Merge successful"
    else
        echo "⚠️  Merge conflicts detected!"
        echo ""
        echo "Please resolve conflicts manually:"
        echo "  1. Open conflicting files and resolve conflicts"
        echo "  2. Stage resolved files: git add <file>"
        echo "  3. Complete merge: git merge --continue"
        echo "  4. Re-run this script: ./scripts/sync-upstream.sh"
        exit 1
    fi

    # Push release branch
    echo ""
    echo "Pushing ${RELEASE_BRANCH} to ${ORIGIN_REMOTE}..."
    git push -u "$ORIGIN_REMOTE" "$RELEASE_BRANCH"

    # Create PR
    echo ""
    echo "Creating pull request..."

    CURRENT_FORK_TAGS=$(git tag --sort=-version:refname | grep -E "^v${UPSTREAM_VERSION}\.[0-9]+$" | head -1)

    gh pr create \
        --base "$FORK_BRANCH" \
        --head "$RELEASE_BRANCH" \
        --title "sync: upstream ${LATEST_UPSTREAM_TAG}" \
        --body "$(cat <<EOF
## Upstream Sync

Syncing upstream release **${LATEST_UPSTREAM_TAG}** into \`${FORK_BRANCH}\`.

This PR merges the latest upstream changes with your fork's customizations.

### Next Steps

After merging this PR:

1. Verify the merge on \`${FORK_BRANCH}\`
2. Run the finalize command to tag the sync point:
   \`\`\`bash
   ./scripts/sync-upstream.sh --finalize
   \`\`\`
   This will create and push the \`${FORK_SYNC_TAG}\` tag.

3. (Optional) Build and deploy a fork release:
   \`\`\`bash
   ./scripts/flyio-build-image.sh
   \`\`\`
   This will auto-increment to \`v${UPSTREAM_VERSION}.1\` or higher.
EOF
)"

    PR_NUMBER=$(gh pr view --json number --jq .number 2>/dev/null || echo "?")

    echo ""
    echo "✓ Sync PR created!"
    echo ""
    echo "Next steps:"
    echo "  1. Review and merge the PR in GitHub"
    echo "  2. Run: ./scripts/sync-upstream.sh --finalize"
    echo "  3. Commit the ${FORK_SYNC_TAG} tag to mark the sync boundary"

fi

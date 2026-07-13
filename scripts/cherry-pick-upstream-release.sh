#!/usr/bin/env zsh

# cherry-pick-upstream-release.sh - Apply an upstream release tag range onto a fork release branch.
#
# This helper is intentionally narrower than scripts/sync-upstream.sh:
# - it does not create a PR
# - it does not tag a fork release
# - it does not commit lockfile changes from upstream
# - it leaves the final commit/review/validation workflow to the operator
#
# Usage:
#   ./scripts/cherry-pick-upstream-release.sh v26.6.0 v26.7.0

set -euo pipefail

LOCKFILES=(yarn.lock package-lock.json)

usage() {
  cat <<'EOF'
Usage:
  ./scripts/cherry-pick-upstream-release.sh <previous-upstream-tag> <new-upstream-tag>

Example:
  ./scripts/cherry-pick-upstream-release.sh v26.6.0 v26.7.0

Run this from a clean release/vX.Y.Z branch created from fork/master.
EOF
}

die() {
  echo "Error: $*" >&2
  exit 1
}

run() {
  echo "+ $*"
  "$@"
}

lockfile_is_in_index() {
  git ls-files --error-unmatch "$1" >/dev/null 2>&1
}

restore_lockfiles_from_head() {
  local file

  for file in "${LOCKFILES[@]}"; do
    if git cat-file -e "HEAD:${file}" 2>/dev/null; then
      git checkout --ours -- "$file" >/dev/null 2>&1 || true
      git restore --source=HEAD --staged --worktree -- "$file" >/dev/null 2>&1 || true
      git add "$file" >/dev/null 2>&1 || true
      echo "Restored ${file} from HEAD; regenerate it with yarn install after cherry-pick resolution."
    elif lockfile_is_in_index "$file" || [[ -e "$file" ]]; then
      git rm -f --ignore-unmatch "$file" >/dev/null 2>&1 || true
      echo "Removed upstream-added ${file}; regenerate dependency state with yarn install after cherry-pick resolution."
    fi
  done
}

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

previous_tag="$1"
new_tag="$2"
expected_branch="release/${new_tag}"
current_branch="$(git branch --show-current)"

[[ "$previous_tag" =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]] || die "previous tag must look like vX.Y.Z"
[[ "$new_tag" =~ '^v[0-9]+\.[0-9]+\.[0-9]+$' ]] || die "new tag must look like vX.Y.Z"

git rev-parse --verify --quiet "$previous_tag" >/dev/null || die "missing tag ${previous_tag}; fetch it first"
git rev-parse --verify --quiet "$new_tag" >/dev/null || die "missing tag ${new_tag}; fetch it first"

if [[ "$current_branch" != "$expected_branch" ]]; then
  die "expected to run on ${expected_branch}, but current branch is ${current_branch:-detached}"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  die "working tree is not clean; commit, stash, or discard changes before starting"
fi

echo "Cherry-picking upstream range ${previous_tag}..${new_tag} onto ${current_branch}."
echo "Lockfiles will be restored from HEAD and must be regenerated with yarn install after conflicts are resolved."
echo ""

if run git cherry-pick --no-commit "${previous_tag}..${new_tag}"; then
  restore_lockfiles_from_head
  cat <<EOF

Cherry-pick range applied without conflicts.

Next steps:
  1. Run: yarn install
  2. Review changes: git status && git diff
  3. Commit the resolved upstream sync changes.
  4. Run gates in order: yarn build, yarn test, yarn lint:fix, yarn typecheck

EOF
else
  restore_lockfiles_from_head
  cat <<EOF

Cherry-pick stopped on conflicts.

Conflict protocol:
  1. Do not resolve ${LOCKFILES[*]} manually; this script restored or removed them from HEAD.
  2. Resolve all non-lockfile conflicts.
  3. Stage resolved files: git add <files>
  4. Continue or commit the cherry-pick result according to git status.
  5. After the cherry-pick is fully resolved, run: yarn install
  6. Run gates in order: yarn build, yarn test, yarn lint:fix, yarn typecheck

EOF
  exit 1
fi

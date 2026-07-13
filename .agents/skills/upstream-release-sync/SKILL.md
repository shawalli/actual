---
name: upstream-release-sync
description: Sync an upstream Actual Budget release tag into this fork's release branch using the fork-safe cherry-pick workflow, lockfile regeneration, and sequential gates.
allow_implicit_invocation: true
---

# Upstream Release Sync

Use this skill when syncing an upstream `actualbudget/actual` tag such as `v26.7.0` into this fork.

## Core Rule

Do not merge an upstream release tag directly into a branch created from `fork/master`.

This fork can have squash-style or fork-specific sync history, so `git merge vX.Y.Z` may choose an older merge base and produce excessive conflicts. Prefer applying the upstream release range onto a release branch created from `fork/master`.

## Branch Setup

1. Fetch the upstream tags:

   ```bash
   git fetch upstream tag vX.Y.Z
   ```

2. Create the release branch from `fork/master`:

   ```bash
   git checkout fork/master
   git pull origin fork/master
   git checkout -b release/vX.Y.Z
   ```

3. Apply the upstream range from the previous upstream tag to the new upstream tag:

   ```bash
   ./scripts/cherry-pick-upstream-release.sh vX.Y.W vX.Y.Z
   ```

   Example:

   ```bash
   ./scripts/cherry-pick-upstream-release.sh v26.6.0 v26.7.0
   ```

## Lockfile Protocol

Never manually merge `yarn.lock` or `package-lock.json` from upstream.

- Keep lockfiles out of the cherry-picked upstream diff.
- Resolve source/package conflicts first.
- After the cherry-pick has been fully resolved, run `yarn install` from the repository root.
- Commit the regenerated dependency state only after `yarn install` has completed.

## Conflict Protocol

1. Inspect conflicts with `git status --short`.
2. Resolve source conflicts by preserving fork behavior where intentional and taking upstream changes where they are not fork-specific.
3. For lockfiles, restore the fork side or remove upstream-added lockfiles, then regenerate with Yarn after the cherry-pick is complete.
4. Search for conflict markers before validation:

   ```bash
   rg -n "^(<<<<<<<|=======|>>>>>>>|<<<<<<<<|>>>>>>>>)" . --glob "!.git/**" --glob "!yarn.lock"
   ```

5. Run `yarn install` from the repository root.

## Fork-Only Dependencies

When a dependency is added for a fork-only feature, record it in the owning workspace `package.json` with `forkMetadata.dependencies`.

Example:

```json
"forkMetadata": {
  "dependencies": {
    "@emoji-mart/data": {
      "owner": "fork",
      "reason": "Fork flag emoji picker feature",
      "source": "fork/master",
      "upstreamTag": "v26.7.0"
    }
  }
}
```

Do not add `forkMetadata` entries for dependencies that already come from upstream.

## Sequential Gates

Run gates in this exact order and stop at the first failure:

1. `yarn build`
2. `yarn test`
3. `yarn lint:fix`
4. `yarn typecheck`

If a later fix changes source code after an earlier gate passed, rerun the affected earlier gates before declaring the branch working.

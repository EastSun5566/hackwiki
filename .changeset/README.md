# Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) for package versioning and changelogs.

## Common commands

- `pnpm run changeset` — create a new release note for published packages
- `pnpm run version` — apply version bumps and update package changelogs
- `pnpm run release` — run the workspace checks and publish unpublished package versions

## Notes

- The current default release branch is `main`.
- Public packages are published under the `@hackwiki` npm scope.

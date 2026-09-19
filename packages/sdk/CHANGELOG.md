# @hackwiki/sdk

## 0.4.0

### Minor Changes

- 5ca135b: Add multi-term ranked search with type filters, summary updates, page rename/delete, stdin content, and command-specific help.

## 0.3.0

### Minor Changes

- be4f7ae: Require explicit wiki initialization, keep read commands read-only, add optional team workspace routing, and include index metadata in CLI page-read JSON when available.

## 0.2.0

### Minor Changes

- 937e8ed: Add agent maintainer workflow support with schema/index/log operations, structured index parsing, full-text search, page listing, and rule-based lint issues.

## 0.1.0

### Minor Changes

- 5680ade: <!-- markdownlint-disable-file MD041 -->

  Prepare the first public workspace release for `@hackwiki/sdk` and `@hackwiki/cli`.

  This release introduces the split from the old single-package repo into:

  - `@hackwiki/sdk` for the TypeScript API
  - `@hackwiki/cli` for the `hackwiki` terminal command

  Existing consumers of the old `hackwiki` package should migrate to `@hackwiki/sdk`.

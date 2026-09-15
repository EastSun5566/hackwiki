# @hackwiki/cli

## 0.4.0

### Minor Changes

- be4f7ae: Require explicit wiki initialization, keep read commands read-only, add optional team workspace routing, and include index metadata in CLI page-read JSON when available.

### Patch Changes

- Updated dependencies [be4f7ae]
  - @hackwiki/sdk@0.3.0

## 0.3.0

### Minor Changes

- 4aece17: Use only official hackmd-cli authentication settings from HMD_API_ACCESS_TOKEN, HMD_API_ENDPOINT_URL, and ~/.hackmd/config.json. HACKMD_TOKEN and HACKMD_API_URL are no longer read by the CLI.

## 0.2.0

### Minor Changes

- 937e8ed: Add agent maintainer workflow support with schema/index/log operations, structured index parsing, full-text search, page listing, and rule-based lint issues.

### Patch Changes

- Updated dependencies [937e8ed]
  - @hackwiki/sdk@0.2.0

## 0.1.0

### Minor Changes

- 5680ade: <!-- markdownlint-disable-file MD041 -->

  Prepare the first public workspace release for `@hackwiki/sdk` and `@hackwiki/cli`.

  This release introduces the split from the old single-package repo into:

  - `@hackwiki/sdk` for the TypeScript API
  - `@hackwiki/cli` for the `hackwiki` terminal command

  Existing consumers of the old `hackwiki` package should migrate to `@hackwiki/sdk`.

### Patch Changes

- Updated dependencies [5680ade]
  - @hackwiki/sdk@0.1.0

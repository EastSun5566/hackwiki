---
name: hackwiki
description: Use the Hackwiki CLI to inspect, search, create, update, and lint a HackMD-backed knowledge base when the user wants to work with Hackwiki notes from an agent.
---

# Hackwiki CLI

## When to Use

Use this skill when the user wants to:

- initialize or inspect a Hackwiki session
- create or update Hackwiki pages in HackMD
- read existing page contents by note ID
- search the Hackwiki index or run lint checks

## Steps

1. Ensure `HACKMD_TOKEN` is available in the environment before invoking the CLI.
2. Prefer machine-readable output by adding `--json` when the result needs to be parsed or chained.
3. Use the Hackwiki CLI through one of these execution modes:
   - `hackwiki ...` if the CLI is already installed or available through `pnpm exec`
   - `npx @hackwiki/cli ...` when zero-install execution is preferred
4. Map the user request to one of these commands:
   - `hackwiki session --json`
   - `hackwiki search "<query>" --json`
   - `hackwiki lint --json`
   - `hackwiki page read <noteId> --json`
   - `hackwiki page create <raw|concept|entity|synthesis> "<title>" --summary "<summary>" --content "<markdown>" --json`
   - `hackwiki page update <noteId> --content "<markdown>" --json`
5. Read errors from `stderr` and results from `stdout`.
6. If the CLI reports a usage error, correct the command shape before retrying.

## Notes

- The CLI expects Hackwiki-managed metadata under `__HACKWIKI__/meta/`.
- New pages are created directly under `__HACKWIKI__/`.
- Use `--file <path>` instead of `--content` when the markdown already exists on disk.

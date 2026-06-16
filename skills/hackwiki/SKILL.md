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

1. Ensure HackMD authentication is available before invoking the CLI. Prefer an existing official `hackmd-cli login`; otherwise use `HMD_API_ACCESS_TOKEN`.
2. Start every Hackwiki task with `hackwiki session --json` to load the schema, index, and recent log before deciding what to read or edit.
3. Follow the schema note as the source of truth for page formats, ingest/query/lint workflows, link style, and index/log maintenance.
4. Prefer machine-readable output by adding `--json` when the result needs to be parsed or chained.
5. Use the Hackwiki CLI through one of these execution modes:
   - `hackwiki ...` if the CLI is already installed or available through `pnpm exec`
   - `npx @hackwiki/cli ...` when zero-install execution is preferred
6. Map the user request to one of these commands:
   - `hackwiki session --json`
   - `hackwiki schema read --json`
   - `hackwiki schema update --file <path> --json`
   - `hackwiki index read --json`
   - `hackwiki log read --json`
   - `hackwiki log append "<operation>" "<title>" --json`
   - `hackwiki page list --json`
   - `hackwiki search "<query>" --json`
   - `hackwiki search "<query>" --full-text --json`
   - `hackwiki lint --json`
   - `hackwiki page read <noteId> --json`
   - `hackwiki page create <raw|concept|entity|synthesis> "<title>" --summary "<summary>" --content "<markdown>" --json`
   - `hackwiki page update <noteId> --content "<markdown>" --json`
7. For ingest work, create or update all affected pages, keep the index current, append a log entry, then run `hackwiki lint --json`.
8. For query work, search the index first, use full-text search when the index is insufficient, read relevant pages, and file durable answers as synthesis pages.
9. Read errors from `stderr` and results from `stdout`.
10. If the CLI reports a usage error, correct the command shape before retrying.

## Notes

- The CLI expects Hackwiki-managed metadata under `__HACKWIKI__/meta/`.
- The CLI can reuse `~/.hackmd/config.json` created by `hackmd-cli login`.
- Use `HMD_API_ENDPOINT_URL` or `--api-url` when targeting HackMD EE.
- New pages are created directly under `__HACKWIKI__/`.
- Use `--file <path>` instead of `--content` when the markdown already exists on disk.
- Treat lint issues as maintenance hints and fix the ones with clear evidence.

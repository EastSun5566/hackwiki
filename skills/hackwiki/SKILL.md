---
name: hackwiki
description: Use the Hackwiki CLI to inspect, search, and maintain a HackMD-backed wiki when the user asks to work with Hackwiki notes.
---

# Hackwiki CLI

## Authentication

Use `HMD_API_ACCESS_TOKEN` or an existing `hackmd-cli login` config; the CLI
binary is optional. If `session` reports a missing token, ask the user to set
the environment variable or, for interactive login, ask before following the
[official HackMD CLI skill](https://github.com/hackmdio/hackmd-cli/blob/develop/hackmd-cli/SKILL.md)
to install the CLI. The user creates and enters the API token; then retry
`session`.

## Workflow

1. If the user specifies a team, pass `--team <teamPath>` to every command or set `HACKWIKI_TEAM_PATH`; never switch workspace during a task. Run `hackwiki session --json` (or `npx @hackwiki/cli session --json`) and confirm its `workspace` before continuing. If the wiki is not initialized, ask the user before running `hackwiki init --json` in that same workspace.
2. Follow the wiki's schema. Search before creating a page; use `hackwiki search "<query>" --json`, then `hackwiki page read <noteId> --json`. Add `--type <type>` to narrow results or `--full-text` when needed.
3. Answer questions from existing pages without writing. Save only knowledge worth reusing, and only when the user requests or confirms a wiki change. Update existing pages instead of creating duplicates.
4. When saving a source, record its origin in the raw page. Link conclusions back to sources. Explain conflicting evidence before changing a conclusion.
5. For approved changes, use `page create`, `page update`, or `page rename`; the CLI maintains the index and log. Never run `page delete` without explicit user confirmation. Run `hackwiki lint --json` afterward. Fix issues caused by this change; report unrelated issues.

Use `--file <path>` for existing Markdown or `--file -` for stdin, `--json` for machine-readable output, and `hackwiki <command> --help` for command details. Use `--api-url` or `HMD_API_ENDPOINT_URL` for HackMD EE.

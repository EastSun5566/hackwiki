---
name: hackwiki
description: Use the Hackwiki CLI to inspect, search, and maintain a HackMD-backed wiki when the user asks to work with Hackwiki notes.
---

# Hackwiki CLI

## Workflow

1. Use the existing `hackmd-cli login` or `HMD_API_ACCESS_TOKEN`. If the user specifies a team, pass `--team <teamPath>` to every command or set `HACKWIKI_TEAM_PATH`; never switch workspace during a task. Run `hackwiki session --json` (or `npx @hackwiki/cli session --json`) and confirm its `workspace` before continuing. If the CLI says the wiki is not initialized, ask the user before running `hackwiki init --json` in that same workspace.
2. Follow the wiki's schema. Search before creating a page; use `hackwiki search "<query>" --json`, then `hackwiki page read <noteId> --json`. Add `--full-text` when needed.
3. Answer questions from existing pages without writing. Save only knowledge worth reusing, and only when the user requests or confirms a wiki change. Update existing pages instead of creating duplicates.
4. When saving a source, record its origin in the raw page. Link conclusions back to sources. Explain conflicting evidence before changing a conclusion.
5. For approved changes, use `page create` or `page update`; the CLI maintains the index and log. Run `hackwiki lint --json` afterward. Fix issues caused by this change; report unrelated issues.

Use `--file <path>` for existing Markdown, `--json` for machine-readable output, and `hackwiki --help` for command details. Use `--api-url` or `HMD_API_ENDPOINT_URL` for HackMD EE.

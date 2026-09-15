# @hackwiki/cli

A terminal and agent-friendly CLI for the Hackwiki SDK.

## Install

```sh
npm install -g @hackwiki/cli
```

Or run it without a global install:

```sh
npx @hackwiki/cli --help
```

## Commands

```sh
hackwiki session --json
hackwiki init --json  # only after user confirmation, if needed
hackwiki init --team TEAM_PATH --json  # optional team workspace
hackwiki schema read --json
hackwiki schema update --file ./schema.md --json
hackwiki index read --json
hackwiki log read --json
hackwiki log append ingest "RAG Article" --json
hackwiki page list --json
hackwiki search "retrieval"
hackwiki search "grounding" --full-text --json
hackwiki page create concept "RAG" --summary "retrieval" --content "# RAG"
hackwiki page update NOTE_ID --file ./note.md
hackwiki page read NOTE_ID
hackwiki lint --json
```

Inside this monorepo during development, you can run the built CLI with:

```sh
pnpm --filter @hackwiki/cli run cli --help
```

## Environment

The CLI can reuse the official `hackmd-cli` login config:

```sh
hackmd-cli login
npx @hackwiki/cli session --json
```

`session` and other read commands do not create a wiki. If it is not initialized,
run `hackwiki init --json` after approval; write commands also require this step.
`page read NOTE_ID --json` adds index metadata when the page is indexed.
For a team wiki, pass `--team TEAM_PATH` to every command or set
`HACKWIKI_TEAM_PATH`. The session output identifies the selected workspace.

Token precedence:

1. `HMD_API_ACCESS_TOKEN`
2. `~/.hackmd/config.json` from `hackmd-cli login`

API URL precedence:

1. `--api-url`
2. `HMD_API_ENDPOINT_URL`
3. `~/.hackmd/config.json`

Team precedence: `--team`, then `HACKWIKI_TEAM_PATH`, then personal workspace.

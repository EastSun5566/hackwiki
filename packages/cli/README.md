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
hackwiki search "retrieval"
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

- The CLI only reads values that are already present in `process.env`.
- `HACKMD_TOKEN` — required
- `HACKMD_API_URL` — optional override for the HackMD API base URL

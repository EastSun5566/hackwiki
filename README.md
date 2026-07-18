# Hackwiki

> A CLI and agent skill for maintaining a persistent wiki in HackMD.

## Use with an agent

Paste this prompt into an agent with shell access:

```text
Install the Hackwiki skill from EastSun5566/hackwiki with:
`npx skills add EastSun5566/hackwiki --skill hackwiki`

Follow the installed skill and use `npx @hackwiki/cli` with `--json`.
Reuse my existing `hackmd-cli login`. If authentication is unavailable, stop
and tell me how to set it up.

Start with `npx @hackwiki/cli session --json`. Search before creating pages,
update existing pages instead of creating duplicates, and run lint after every
change. Inspect the wiki first and do not modify it until I confirm.
```

## Authentication

```sh
hackmd-cli login
npx @hackwiki/cli session --json
```

For automation, set `HMD_API_ACCESS_TOKEN`. For HackMD EE, also set
`HMD_API_ENDPOINT_URL` or use `--api-url`.

## CLI

```sh
npx @hackwiki/cli session --json
npx @hackwiki/cli search "retrieval" --json
npx @hackwiki/cli search "grounding" --full-text --json
npx @hackwiki/cli page read NOTE_ID --json
npx @hackwiki/cli page create concept "RAG" \
  --summary "Retrieval-augmented generation" \
  --file ./rag.md \
  --json
npx @hackwiki/cli page update NOTE_ID --file ./rag.md --json
npx @hackwiki/cli lint --json
```

Run `npx @hackwiki/cli --help` for all commands.

Hackwiki stores its schema, index, log, and wiki pages in a dedicated
`__HACKWIKI__/` folder in HackMD.

## Development

```sh
pnpm install
pnpm build
pnpm lint
pnpm test
```

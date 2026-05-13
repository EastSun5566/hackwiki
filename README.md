# Hackwiki

> A HackMD-backed knowledge-base toolkit for SDK, CLI, and agent workflows

Hackwiki is now organized as a pnpm workspace:

- `@hackwiki/sdk` — the TypeScript library
- `@hackwiki/cli` — a thin CLI around the SDK
- `skills/hackwiki` — agent skill

## Layout

Hackwiki keeps all managed notes inside a dedicated HackMD folder tree:

- `__HACKWIKI__/meta/[hackwiki] schema`
- `__HACKWIKI__/meta/[hackwiki] index`
- `__HACKWIKI__/meta/[hackwiki] log`

Regular wiki pages are created directly under `__HACKWIKI__/`.

Pages have four types: `raw`, `concept`, `entity`, and `synthesis`.

## Packages

### `@hackwiki/sdk`

Install the SDK in another project:

```sh
npm install @hackwiki/sdk
```

```ts
import { createWiki } from "@hackwiki/sdk";

const wiki = createWiki({
  token: process.env.HACKMD_TOKEN,
});

const session = await wiki.startSession();

const { noteId } = await wiki.createPage(
  "concept",
  "Retrieval-Augmented Generation",
  "# RAG\n\n...",
  "Pattern for grounding LLM output in retrieved documents",
);

await wiki.updatePage(noteId, "# RAG\n\nUpdated content...");
const results = await wiki.searchIndex("retrieval");
const { orphanPages, undocumentedMentions } = await wiki.lint();
```

### `@hackwiki/cli`

Run the CLI without a global install:

```sh
npx @hackwiki/cli --help
```

Common commands:

```sh
hackwiki session --json
hackwiki search "retrieval" --json
hackwiki page create concept "RAG" --summary "retrieval" --content "# RAG" --json
hackwiki page update NOTE_ID --file ./note.md --json
hackwiki page read NOTE_ID --json
hackwiki lint --json
```

The CLI reads `HACKMD_TOKEN` from the environment.

## Skills

```sh
npx skills add EastSun5566/hackwiki
```

Once installed, the skill instructs the agent to prefer the Hackwiki CLI with machine-readable `--json` output when appropriate.

## Development

Install dependencies once at the workspace root:

```sh
pnpm install
```

Run the workspace checks:

```sh
pnpm build
pnpm test
pnpm lint
```

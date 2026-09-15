# @hackwiki/sdk

A TypeScript SDK for maintaining a persistent, LLM-friendly wiki backed by HackMD notes.

## Install

```sh
npm install @hackwiki/sdk
```

## Usage

```ts
import { createWiki } from "@hackwiki/sdk";

const wiki = createWiki({
  token: process.env.HMD_API_ACCESS_TOKEN,
});

// Only after the user approves creating the wiki, if it does not exist:
await wiki.initialize();
const session = await wiki.startSession();
const schema = await wiki.readSchema();
const pages = await wiki.listPages();
const result = await wiki.createPage(
  "concept",
  "Retrieval-Augmented Generation",
  "# RAG\n\n...",
  "Pattern for grounding LLM output in retrieved documents",
);
const hits = await wiki.searchIndex("retrieval", { fullText: true });
```

The managed HackMD layout uses `__HACKWIKI__/meta/` for reserved notes and creates wiki pages directly under `__HACKWIKI__/`.
`startSession()` and other read methods do not initialize the wiki. Write methods
require initialization too; call `initialize()` explicitly when approved.

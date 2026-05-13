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
  token: process.env.HACKMD_TOKEN,
});

const session = await wiki.startSession();
const result = await wiki.createPage(
  "concept",
  "Retrieval-Augmented Generation",
  "# RAG\n\n...",
  "Pattern for grounding LLM output in retrieved documents",
);
```

The managed HackMD layout uses `__HACKWIKI__/meta/` for reserved notes and creates wiki pages directly under `__HACKWIKI__/`.

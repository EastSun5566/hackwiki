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
  // teamPath: "my-team", // omit for the personal workspace
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
await wiki.updatePage(result.noteId, undefined, "Updated summary");
await wiki.renamePage(result.noteId, "RAG Guide");
await wiki.deletePage(result.noteId);
```

The managed HackMD layout uses `__HACKWIKI__/meta/` for reserved notes and creates wiki pages directly under `__HACKWIKI__/`.
`startSession()` and other read methods do not initialize the wiki. Write methods
require initialization too; call `initialize()` explicitly when approved.
The session's `workspace` field confirms whether this instance targets the
personal workspace or a specific team.
Search supports multi-term matching, deterministic ranking, and an optional
`type` filter. Rename and delete update the HackMD note, index, and log.

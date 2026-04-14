# Hackwiki

A library for maintaining a persistent, LLM-friendly wiki backed by HackMD team notes.

## Concept

Three meta notes anchor the wiki:

- **schema** — describes the wiki's domain and vocabulary
- **index** — lists all pages with type, title, and summary
- **log** — append-only record of operations

Pages have four types: `raw`, `concept`, `entity`, `synthesis`.

## Install

```sh
pnpm add hackwiki
```

## Usage

```ts
import { createWiki } from "hackwiki";

const wiki = createWiki({
  token: process.env.HACKMD_TOKEN,
  teamPath: "my-team",
});

// First time: create the three meta notes
const meta = await wiki.bootstrap();

// Later: reuse existing meta notes
wiki.load({ schemaId: "...", indexId: "...", logId: "..." });

// Read current state for an LLM session
const session = await wiki.startSession();
// session.schema, session.index, session.recentLog

// Create a page
const { noteId, indexSize } = await wiki.createPage(
  "concept",
  "Retrieval-Augmented Generation",
  "# RAG\n\n...",
  "Pattern for grounding LLM output in retrieved documents",
);

// Update a page
await wiki.updatePage(noteId, "# RAG\n\nUpdated content...");

// Search the index
const results = await wiki.searchIndex("retrieval");

// Lint for orphans and undocumented [[wiki-links]]
const { orphanPages, undocumentedMentions } = await wiki.lint();
```

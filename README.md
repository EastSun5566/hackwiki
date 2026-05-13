# Hackwiki

> A library for maintaining a persistent, LLM-friendly wiki backed by HackMD notes

## Concept

Three meta notes anchor the wiki:

- **schema** — describes the wiki's domain and vocabulary
- **index** — lists all pages with type, title, and summary
- **log** — append-only record of operations

These reserved notes live under a managed HackMD folder layout:

- `__HACKWIKI__/meta/[hackwiki] schema`
- `__HACKWIKI__/meta/[hackwiki] index`
- `__HACKWIKI__/meta/[hackwiki] log`

Pages have four types: `raw`, `concept`, `entity`, `synthesis`.

## Install

```sh
npm install hackwiki
```

## Usage

```ts
import { createWiki } from "hackwiki";

const wiki = createWiki({
  token: process.env.HACKMD_TOKEN,
});

// The first call auto-discovers or creates the reserved hackwiki notes
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

By default, hackwiki stores all managed notes inside a dedicated `__HACKWIKI__` folder in your HackMD personal space. Reserved metadata notes live in `__HACKWIKI__/meta/`, while regular wiki pages are created directly under `__HACKWIKI__/`.

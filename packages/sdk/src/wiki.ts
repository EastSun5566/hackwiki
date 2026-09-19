import { createClient, type WikiClient } from './client.ts'
import { serializeIndex, parseIndex, formatLogEntry, parseRecentLog } from './parser.ts'
import type {
  WikiNoteType,
  WikiIndexEntry,
  WikiSession,
  LintReport,
  LintIssue,
  NoteSummary,
  FolderSummary,
  WikiWorkspace,
} from './types.ts'

const SCHEMA_TITLE = '[hackwiki] schema'
const INDEX_TITLE  = '[hackwiki] index'
const LOG_TITLE    = '[hackwiki] log'
const ROOT_FOLDER_NAME = '__HACKWIKI__'
const META_FOLDER_NAME = 'meta'
const HACKWIKI_TAG = 'hackwiki'
const DEFAULT_SCHEMA = `# Hackwiki Schema

## Purpose

Hackwiki is a persistent, HackMD-backed wiki maintained by agents. Raw sources are the source of truth; wiki pages are maintained summaries, entities, concepts, and synthesis notes.

## Page Types

- raw: immutable or lightly cleaned source material. Record where it came from and do not rewrite its meaning.
- concept: reusable ideas, patterns, mechanisms, or topics.
- entity: people, organizations, projects, products, places, or named objects.
- synthesis: cross-page analysis, comparisons, timelines, decisions, or answers worth keeping.

## Page Format

Each managed page should use:

1. A single H1 title.
2. A short summary near the top.
3. Sections with stable headings.
4. Wiki links as [[Page Title]] when referring to another indexed page.
5. Markdown links with note IDs when linking directly to HackMD notes.

## Ingest Workflow

1. Run \`hackwiki session --json\` with the current workspace options and read the schema, index, and recent log.
2. Search before creating pages, then read the source and identify what is worth reusing.
3. Create a raw page for a new source and record its origin.
4. Update or rename existing concept/entity/synthesis pages instead of creating duplicates. Never delete a page without explicit user confirmation. Link conclusions back to their sources and note conflicts before changing them.
5. The CLI records new pages in the index and log automatically.
6. Run \`hackwiki lint --json\`; fix issues caused by this change and report unrelated issues.

## Query Workflow

1. Start with \`hackwiki session --json\` using the same workspace for the whole task.
2. Search the index first, using a page-type filter when useful, then read relevant pages.
3. Answer with citations to page titles or note IDs.
4. Do not save a routine answer. Propose a synthesis page for durable knowledge only when the user asks to save it or confirms the change.

## Lint Workflow

Treat lint output as maintenance hints. Fix missing wiki-link targets, broken note links, duplicate index titles, and orphan concept/entity/synthesis pages when the fix is clear.
`

export interface SearchOptions {
  fullText?: boolean
  type?: WikiNoteType
}

type WikiMeta = {
  rootFolderId: string
  metaFolderId: string
  schemaId: string
  indexId: string
  logId: string
}

export interface WikiOptions {
  token: string
  initialSchema?: string
  apiUrl?: string
  teamPath?: string
}

export interface CreatePageResult {
  noteId: string
  indexSize: number
}

export class WikiNotInitializedError extends Error {
  constructor(workspace: WikiWorkspace = { type: 'personal' }) {
    const target = workspace.type === 'team'
      ? `team "${workspace.teamPath}"`
      : 'personal workspace'
    super(`Hackwiki is not initialized in ${target}. Run \`hackwiki init\` or call \`wiki.initialize()\` after user confirmation.`)
    this.name = 'WikiNotInitializedError'
  }
}

export class Wiki {
  readonly api: WikiClient
  readonly initialSchema: string
  readonly workspace: WikiWorkspace
  meta: WikiMeta | null = null
  bootstrapping: Promise<WikiMeta> | null = null

  constructor(config: WikiOptions, client?: WikiClient) {
    const teamPath = config.teamPath?.trim()
    if (config.teamPath !== undefined && !teamPath) {
      throw new Error('Team path cannot be empty.')
    }

    this.workspace = teamPath
      ? { type: 'team', teamPath }
      : { type: 'personal' }
    this.api = client ?? createClient(config.token, config.apiUrl, teamPath)
    this.initialSchema = config.initialSchema ?? DEFAULT_SCHEMA
  }

  initialize = async (): Promise<WikiSession> => {
    await this.bootstrap()
    return this.startSession()
  }

  startSession = async (): Promise<WikiSession> => {
    const m = await this.requireMeta()
    const [schema, index, log] = await Promise.all([
      this.api.getNote(m.schemaId),
      this.api.getNote(m.indexId),
      this.api.getNote(m.logId),
    ])
    return {
      workspace: this.workspace,
      schema:    schema.content ?? '',
      index:     parseIndex(index.content ?? ''),
      recentLog: parseRecentLog(log.content ?? ''),
    }
  }

  createPage = async (
    type: WikiNoteType,
    title: string,
    content: string,
    summary: string,
  ): Promise<CreatePageResult> => {
    const { rootFolderId } = await this.requireMeta()
    const note = await this.api.createNote({
      title:           `[${type}] ${title}`,
      content,
      tags:            [HACKWIKI_TAG],
      readPermission:  'owner',
      writePermission: 'owner',
      parentFolderId:  rootFolderId,
    })
    const [entries] = await Promise.all([
      this.addToIndex({ noteId: note.id, type, title, summary }),
      this.appendLog('create', title),
    ])
    return { noteId: note.id, indexSize: entries.length }
  }

  updatePage = async (
    noteId: string,
    content?: string,
    summary?: string,
  ): Promise<void> => {
    if (content === undefined && summary === undefined) {
      throw new Error('Page update requires content or summary.')
    }
    if (summary !== undefined && !summary.trim()) {
      throw new Error('Page summary cannot be empty.')
    }

    const entries = summary === undefined ? undefined : await this.getIndex()
    const index = entries?.findIndex(entry => entry.noteId === noteId)
    if (index === -1) throw new Error(`Page ${noteId} is not present in the Hackwiki index.`)

    if (content !== undefined) {
      await this.requireMeta()
      await this.api.updateNote(noteId, { content })
    }
    if (entries && index !== undefined && summary !== undefined) {
      entries[index] = { ...entries[index], summary }
      await this.updateIndex(entries)
    }
    await this.appendLog('update', noteId)
  }

  renamePage = async (noteId: string, title: string, summary?: string): Promise<void> => {
    if (!title.trim()) throw new Error('Page title cannot be empty.')
    if (summary !== undefined && !summary.trim()) throw new Error('Page summary cannot be empty.')

    const entries = await this.getIndex()
    const index = entries.findIndex(entry => entry.noteId === noteId)
    if (index < 0) throw new Error(`Page ${noteId} is not present in the Hackwiki index.`)

    const entry = entries[index]
    await this.api.updateNote(noteId, { title: `[${entry.type}] ${title}` })
    entries[index] = { ...entry, title, summary: summary ?? entry.summary }
    await this.updateIndex(entries)
    await this.appendLog('rename', `${entry.title} -> ${title}`)
  }

  deletePage = async (noteId: string): Promise<void> => {
    const entries = await this.getIndex()
    const entry = entries.find(item => item.noteId === noteId)
    if (!entry) throw new Error(`Page ${noteId} is not present in the Hackwiki index.`)

    await this.api.deleteNote(noteId)
    await this.updateIndex(entries.filter(item => item.noteId !== noteId))
    await this.appendLog('delete', entry.title)
  }

  readPage = async (noteId: string): Promise<string> => {
    const note = await this.api.getNote(noteId)
    return note.content ?? ''
  }

  findIndexedPage = async (noteId: string): Promise<WikiIndexEntry | undefined> => {
    const meta = await this.findMeta()
    if (!meta) return undefined
    const note = await this.api.getNote(meta.indexId)
    return parseIndex(note.content ?? '').find(entry => entry.noteId === noteId)
  }

  readPages = async (noteIds: string[]): Promise<Map<string, string>> => {
    const results = await Promise.all(
      noteIds.map(async id => {
        const note = await this.api.getNote(id)
        return [id, note.content ?? ''] as const
      }),
    )
    return new Map(results)
  }

  listPages = async (): Promise<WikiIndexEntry[]> => this.getIndex()

  searchIndex = async (
    query: string,
    options: SearchOptions = {},
  ): Promise<WikiIndexEntry[]> => {
    const q = query.trim().toLowerCase()
    const terms = q.split(/\s+/).filter(Boolean)
    const entries = (await this.getIndex()).filter(entry =>
      options.type === undefined || entry.type === options.type
    )
    const contentById = options.fullText
      ? await this.readPages(entries.map(entry => entry.noteId))
      : new Map<string, string>()

    return entries
      .map(entry => {
        const title = entry.title.toLowerCase()
        const summary = entry.summary.toLowerCase()
        const content = (contentById.get(entry.noteId) ?? '').toLowerCase()
        if (!terms.every(term => title.includes(term) || summary.includes(term) || content.includes(term))) {
          return null
        }
        const score = (title === q ? 100 : 0) + terms.reduce((total, term) =>
          total + (title.includes(term) ? 10 : summary.includes(term) ? 5 : 1), 0)
        return { entry, score }
      })
      .filter((result): result is { entry: WikiIndexEntry; score: number } => result !== null)
      .sort((a, b) =>
        b.score - a.score ||
        (a.entry.title < b.entry.title ? -1 : a.entry.title > b.entry.title ? 1 : 0) ||
        (a.entry.noteId < b.entry.noteId ? -1 : a.entry.noteId > b.entry.noteId ? 1 : 0)
      )
      .map(result => result.entry)
  }

  lint = async (): Promise<LintReport> => {
    const entries = await this.getIndex()
    const allContent = await this.readPages(entries.map(e => e.noteId))
    const issues: LintIssue[] = []

    const orphanPages = entries.filter(e => {
      if (e.type === 'raw') return false
      const otherContent = [...allContent.entries()]
        .filter(([id]) => id !== e.noteId)
        .map(([, c]) => c)
        .join('\n')
      return !otherContent.includes(e.noteId) && !otherContent.includes(e.title)
    })
    for (const page of orphanPages) {
      issues.push({
        ruleId:   'orphan-page',
        severity: 'warning',
        message:  `Page "${page.title}" has no inbound references from other indexed pages.`,
        evidence: {
          noteId: page.noteId,
          title:  page.title,
          type:   page.type,
        },
      })
    }

    const merged = [...allContent.values()].join('\n')
    const mentioned = [...merged.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => {
      const rawTarget = match[1].trim()
      return rawTarget.split('|')[0].split('#')[0].trim()
    })
    const indexed = new Set(entries.map(e => e.title))
    const undocumentedMentions = [...new Set(mentioned.filter(t => !indexed.has(t)))]
    for (const title of undocumentedMentions) {
      issues.push({
        ruleId:   'missing-wikilink-target',
        severity: 'warning',
        message:  `Wiki link target "${title}" is not present in the index.`,
        evidence: { title },
      })
    }

    const noteIds = new Set(entries.map(e => e.noteId))
    const markdownLinks = [...merged.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)]
      .map(match => match[1].trim())
    const brokenNoteLinks = [...new Set(markdownLinks.filter(href =>
      !href.startsWith('#') &&
      !href.includes('://') &&
      !href.startsWith('mailto:') &&
      !noteIds.has(href),
    ))]
    for (const href of brokenNoteLinks) {
      issues.push({
        ruleId:   'broken-note-link',
        severity: 'warning',
        message:  `Markdown note link "${href}" does not match an indexed note ID.`,
        evidence: { href },
      })
    }

    const titles = new Map<string, WikiIndexEntry[]>()
    for (const entry of entries) {
      const key = entry.title.trim().toLowerCase()
      titles.set(key, [...(titles.get(key) ?? []), entry])
    }
    for (const duplicates of titles.values()) {
      if (duplicates.length < 2) continue
      issues.push({
        ruleId:   'duplicate-index-title',
        severity: 'error',
        message:  `Index title "${duplicates[0].title}" appears ${duplicates.length} times.`,
        evidence: {
          title:   duplicates[0].title,
          noteIds: duplicates.map(entry => entry.noteId).join(', '),
        },
      })
    }

    return { orphanPages, undocumentedMentions, issues }
  }

  findManagedFolder(
    folders: FolderSummary[],
    name: string,
    parentFolderId: string | null,
  ): FolderSummary | undefined {
    const matches = folders.filter(folder =>
      folder.name === name &&
      (folder.parentFolderId ?? null) === parentFolderId,
    )
    if (matches.length > 1) {
      const location = parentFolderId === null ? 'root' : `folder "${parentFolderId}"`
      throw new Error(`Found multiple managed folders named "${name}" under ${location}.`)
    }
    return matches[0]
  }

  async ensureRootFolder(folders: FolderSummary[]): Promise<FolderSummary> {
    return this.findManagedFolder(folders, ROOT_FOLDER_NAME, null)
      ?? this.api.createFolder({ name: ROOT_FOLDER_NAME })
  }

  async ensureMetaFolder(
    folders: FolderSummary[],
    rootFolderId: string,
  ): Promise<FolderSummary> {
    return this.findManagedFolder(folders, META_FOLDER_NAME, rootFolderId)
      ?? this.api.createFolder({
        name: META_FOLDER_NAME,
        parentFolderId: rootFolderId,
      })
  }

  noteParentFolderId(note: NoteSummary): string | undefined {
    const paths = note.folderPaths ?? []
    const parent = paths[paths.length - 1]
    return typeof parent?.id === 'string' ? parent.id : undefined
  }

  findReservedNoteInFolder(
    notes: NoteSummary[],
    title: string,
    folderId: string,
  ): NoteSummary | undefined {
    const matches = notes.filter(note =>
      note.title === title &&
      this.noteParentFolderId(note) === folderId,
    )
    if (matches.length > 1) {
      throw new Error(`Found multiple reserved notes titled "${title}" in managed folder "${folderId}".`)
    }
    return matches[0]
  }

  async createReservedNoteInFolder(
    title: string,
    content: string,
    parentFolderId: string,
  ): Promise<string> {
    const note = await this.api.createNote({
      title,
      content,
      tags: [HACKWIKI_TAG],
      readPermission:  'owner',
      writePermission: 'owner',
      parentFolderId,
    })
    return note.id
  }

  async initializeMeta(): Promise<WikiMeta> {
    const folders = await this.api.getFolderList()
    const rootFolder = await this.ensureRootFolder(folders)
    const metaFolder = await this.ensureMetaFolder(folders, rootFolder.id)

    const notes = await this.api.getNoteList()

    const schema = this.findReservedNoteInFolder(notes, SCHEMA_TITLE, metaFolder.id)
    const index = this.findReservedNoteInFolder(notes, INDEX_TITLE, metaFolder.id)
    const log = this.findReservedNoteInFolder(notes, LOG_TITLE, metaFolder.id)

    const schemaId = schema?.id ?? await this.createReservedNoteInFolder(
      SCHEMA_TITLE,
      this.initialSchema,
      metaFolder.id,
    )
    const indexId = index?.id ?? await this.createReservedNoteInFolder(
      INDEX_TITLE,
      serializeIndex([]),
      metaFolder.id,
    )
    const logId = log?.id ?? await this.createReservedNoteInFolder(
      LOG_TITLE,
      '# Log\n',
      metaFolder.id,
    )

    this.meta = {
      rootFolderId: rootFolder.id,
      metaFolderId: metaFolder.id,
      schemaId,
      indexId,
      logId,
    }

    return this.meta
  }

  async bootstrap(): Promise<WikiMeta> {
    if (this.meta) return this.meta

    if (!this.bootstrapping) {
      this.bootstrapping = this.initializeMeta().finally(() => {
        this.bootstrapping = null
      })
    }

    return this.bootstrapping
  }

  async findMeta(): Promise<WikiMeta | null> {
    if (this.meta) return this.meta

    const folders = await this.api.getFolderList()
    const root = this.findManagedFolder(folders, ROOT_FOLDER_NAME, null)
    if (!root) return null
    const metaFolder = this.findManagedFolder(folders, META_FOLDER_NAME, root.id)
    if (!metaFolder) return null

    const notes = await this.api.getNoteList()
    const schema = this.findReservedNoteInFolder(notes, SCHEMA_TITLE, metaFolder.id)
    const index = this.findReservedNoteInFolder(notes, INDEX_TITLE, metaFolder.id)
    const log = this.findReservedNoteInFolder(notes, LOG_TITLE, metaFolder.id)
    if (!schema || !index || !log) return null

    this.meta = {
      rootFolderId: root.id,
      metaFolderId: metaFolder.id,
      schemaId: schema.id,
      indexId: index.id,
      logId: log.id,
    }
    return this.meta
  }

  async requireMeta(): Promise<WikiMeta> {
    const meta = await this.findMeta()
    if (!meta) throw new WikiNotInitializedError(this.workspace)
    return meta
  }

  async getIndex(): Promise<WikiIndexEntry[]> {
    const { indexId } = await this.requireMeta()
    const note = await this.api.getNote(indexId)
    return parseIndex(note.content ?? '')
  }

  async readSchema(): Promise<string> {
    const { schemaId } = await this.requireMeta()
    const note = await this.api.getNote(schemaId)
    return note.content ?? ''
  }

  async updateSchema(content: string): Promise<void> {
    const { schemaId } = await this.requireMeta()
    await this.api.updateNote(schemaId, { content })
  }

  async readIndex(): Promise<WikiIndexEntry[]> {
    return this.getIndex()
  }

  async updateIndex(entries: WikiIndexEntry[]): Promise<void> {
    const { indexId } = await this.requireMeta()
    await this.api.updateNote(indexId, { content: serializeIndex(entries) })
  }

  async readLog(): Promise<string> {
    const { logId } = await this.requireMeta()
    const note = await this.api.getNote(logId)
    return note.content ?? ''
  }

  async addToIndex(entry: WikiIndexEntry): Promise<WikiIndexEntry[]> {
    const { indexId } = await this.requireMeta()
    const entries = await this.getIndex()
    const existing = entries.findIndex(e => e.noteId === entry.noteId)
    if (existing >= 0) entries[existing] = entry
    else entries.push(entry)
    await this.api.updateNote(indexId, { content: serializeIndex(entries) })
    return entries
  }

  async appendLog(operation: string, title: string): Promise<void> {
    const { logId } = await this.requireMeta()
    const note = await this.api.getNote(logId)
    const updated = (note.content ?? '') + formatLogEntry(operation, title)
    await this.api.updateNote(logId, { content: updated })
  }
}

export function createWiki(config: WikiOptions, client?: WikiClient) {
  return new Wiki(config, client)
}

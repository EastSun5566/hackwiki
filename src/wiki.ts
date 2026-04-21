import { createClient, type StoreClient } from './client.ts'
import { serializeIndex, parseIndex, formatLogEntry, parseRecentLog } from './parser.ts'
import type { Wiki as WikiApi, WikiNoteType, WikiIndexEntry, WikiSession, LintReport } from './types.ts'

const SCHEMA_TITLE = '[hackwiki] schema'
const INDEX_TITLE  = '[hackwiki] index'
const LOG_TITLE    = '[hackwiki] log'
const HACKWIKI_TAG = 'hackwiki'
const DEFAULT_SCHEMA = '# Schema\n\n_Fill this in._'

type NoteSummary = {
  id: string
  title?: string
}

type WikiMeta = {
  schemaId: string
  indexId: string
  logId: string
}

export interface WikiConfig {
  token: string
  initialSchema?: string
  apiUrl?: string
}

export interface CreatePageResult {
  noteId: string
  indexSize: number
}

class Wiki implements WikiApi {
  private readonly api: StoreClient
  private readonly initialSchema: string
  private meta: WikiMeta | null = null
  private bootstrapping: Promise<WikiMeta> | null = null

  constructor(config: WikiConfig, client?: StoreClient) {
    this.api = client ?? createClient(config.token, config.apiUrl)
    this.initialSchema = config.initialSchema ?? DEFAULT_SCHEMA
  }

  startSession = async (): Promise<WikiSession> => {
    const m = await this.ensureMeta()
    const [schema, index, log] = await Promise.all([
      this.api.getNote(m.schemaId),
      this.api.getNote(m.indexId),
      this.api.getNote(m.logId),
    ])
    return {
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
    await this.ensureMeta()
    const note = await this.api.createNote({
      title:           `[${type}] ${title}`,
      content,
      tags:            [HACKWIKI_TAG],
      readPermission:  'owner',
      writePermission: 'owner',
    })
    const [entries] = await Promise.all([
      this.addToIndex({ noteId: note.id, type, title, summary }),
      this.appendLog('create', title),
    ])
    return { noteId: note.id, indexSize: entries.length }
  }

  updatePage = async (noteId: string, content: string): Promise<void> => {
    await this.ensureMeta()
    await this.api.updateNote(noteId, { content })
    await this.appendLog('update', noteId)
  }

  readPage = async (noteId: string): Promise<string> => {
    const note = await this.api.getNote(noteId)
    return note.content ?? ''
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

  searchIndex = async (query: string): Promise<WikiIndexEntry[]> => {
    const q = query.toLowerCase()
    const entries = await this.getIndex()
    return entries.filter(e =>
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q),
    )
  }

  lint = async (): Promise<LintReport> => {
    const entries = await this.getIndex()
    const allContent = await this.readPages(entries.map(e => e.noteId))

    const orphanPages = entries.filter(e => {
      if (e.type === 'raw') return false
      const otherContent = [...allContent.entries()]
        .filter(([id]) => id !== e.noteId)
        .map(([, c]) => c)
        .join('\n')
      return !otherContent.includes(e.noteId) && !otherContent.includes(e.title)
    })

    const merged = [...allContent.values()].join('\n')
    const mentioned = [...merged.matchAll(/\[\[([^\]]+)\]\]/g)].map(match => match[1])
    const indexed = new Set(entries.map(e => e.title))
    const undocumentedMentions = [...new Set(mentioned.filter(t => !indexed.has(t)))]

    return { orphanPages, undocumentedMentions }
  }

  private findReservedNote(notes: NoteSummary[], title: string): NoteSummary | undefined {
    const matches = notes.filter(note => note.title === title)
    if (matches.length > 1) {
      throw new Error(`Found multiple reserved notes titled "${title}".`)
    }
    return matches[0]
  }

  private async createReservedNote(title: string, content: string): Promise<string> {
    const note = await this.api.createNote({
      title,
      content,
      tags: [HACKWIKI_TAG],
      readPermission:  'owner',
      writePermission: 'owner',
    })
    return note.id
  }

  private async initializeMeta(): Promise<WikiMeta> {
    const notes = await this.api.getNoteList()

    const schema = this.findReservedNote(notes, SCHEMA_TITLE)
    const index = this.findReservedNote(notes, INDEX_TITLE)
    const log = this.findReservedNote(notes, LOG_TITLE)

    const schemaId = schema?.id ?? await this.createReservedNote(SCHEMA_TITLE, this.initialSchema)
    const indexId = index?.id ?? await this.createReservedNote(INDEX_TITLE, serializeIndex([]))
    const logId = log?.id ?? await this.createReservedNote(LOG_TITLE, '# Log\n')

    this.meta = {
      schemaId,
      indexId,
      logId,
    }

    return this.meta
  }

  private async bootstrap(): Promise<WikiMeta> {
    if (this.meta) return this.meta

    if (!this.bootstrapping) {
      this.bootstrapping = this.initializeMeta().finally(() => {
        this.bootstrapping = null
      })
    }

    return this.bootstrapping
  }

  private async ensureMeta(): Promise<WikiMeta> {
    return this.meta ?? this.bootstrap()
  }

  private async getIndex(): Promise<WikiIndexEntry[]> {
    const { indexId } = await this.ensureMeta()
    const note = await this.api.getNote(indexId)
    return parseIndex(note.content ?? '')
  }

  private async addToIndex(entry: WikiIndexEntry): Promise<WikiIndexEntry[]> {
    const { indexId } = await this.ensureMeta()
    const entries = await this.getIndex()
    const existing = entries.findIndex(e => e.noteId === entry.noteId)
    if (existing >= 0) entries[existing] = entry
    else entries.push(entry)
    await this.api.updateNote(indexId, { content: serializeIndex(entries) })
    return entries
  }

  private async appendLog(operation: string, title: string): Promise<void> {
    const { logId } = await this.ensureMeta()
    const note = await this.api.getNote(logId)
    const updated = (note.content ?? '') + formatLogEntry(operation, title)
    await this.api.updateNote(logId, { content: updated })
  }
}

export function createWiki(config: WikiConfig, client?: StoreClient): WikiApi {
  return new Wiki(config, client)
}

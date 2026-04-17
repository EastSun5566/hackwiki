import HackMDAPI from '@hackmd/api'

import { serializeIndex, parseIndex, formatLogEntry, parseRecentLog } from './parser.ts'
import type { WikiNoteType, WikiIndexEntry, WikiSession, LintReport } from './types.ts'

const SCHEMA_TITLE = '[hackwiki] schema'
const INDEX_TITLE  = '[hackwiki] index'
const LOG_TITLE    = '[hackwiki] log'
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

export interface WikiClient {
  getNoteList(): Promise<NoteSummary[]>
  createNote(opts: Record<string, unknown>): Promise<{ id: string; content?: string }>
  getNote(id: string): Promise<{ id: string; content?: string }>
  updateNote(id: string, opts: Record<string, unknown>): Promise<unknown>
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

export interface Wiki {
  startSession(): Promise<WikiSession>
  createPage(type: WikiNoteType, title: string, content: string, summary: string): Promise<CreatePageResult>
  updatePage(noteId: string, content: string): Promise<void>
  readPage(noteId: string): Promise<string>
  readPages(noteIds: string[]): Promise<Map<string, string>>
  searchIndex(query: string): Promise<WikiIndexEntry[]>
  lint(): Promise<LintReport>
}

export function createWiki(config: WikiConfig, client?: WikiClient): Wiki {
  const api: WikiClient = client ?? (new HackMDAPI(
    config.token,
    config.apiUrl ?? 'https://api.hackmd.io/v1',
  ) as unknown as WikiClient)
  const initialSchema = config.initialSchema ?? DEFAULT_SCHEMA

  let meta: WikiMeta | null = null
  let bootstrapping: Promise<WikiMeta> | null = null

  function findReservedNote(notes: NoteSummary[], title: string): NoteSummary | undefined {
    const matches = notes.filter(note => note.title === title)
    if (matches.length > 1) {
      throw new Error(`Found multiple reserved notes titled "${title}".`)
    }
    return matches[0]
  }

  async function createReservedNote(title: string, content: string): Promise<{ id: string }> {
    return api.createNote({
      title,
      content,
      readPermission:  'owner',
      writePermission: 'owner',
    })
  }

  async function initializeMeta(): Promise<WikiMeta> {
    const notes = await api.getNoteList()

    const schema = findReservedNote(notes, SCHEMA_TITLE)
    const index = findReservedNote(notes, INDEX_TITLE)
    const log = findReservedNote(notes, LOG_TITLE)

    const resolvedSchema = schema ?? await createReservedNote(SCHEMA_TITLE, initialSchema)
    const resolvedIndex = index ?? await createReservedNote(INDEX_TITLE, serializeIndex([]))
    const resolvedLog = log ?? await createReservedNote(LOG_TITLE, '# Log\n')

    meta = {
      schemaId: resolvedSchema.id,
      indexId: resolvedIndex.id,
      logId: resolvedLog.id,
    }

    return meta
  }

  async function bootstrap(): Promise<WikiMeta> {
    if (meta) return meta

    if (!bootstrapping) {
      bootstrapping = initializeMeta().finally(() => {
        bootstrapping = null
      })
    }

    return bootstrapping
  }

  async function ensureMeta(): Promise<WikiMeta> {
    return meta ?? bootstrap()
  }

  async function getIndex(): Promise<WikiIndexEntry[]> {
    const m = await ensureMeta()
    const note = await api.getNote(m.indexId)
    return parseIndex(note.content ?? '')
  }

  async function addToIndex(entry: WikiIndexEntry): Promise<WikiIndexEntry[]> {
    const m = await ensureMeta()
    const entries = await getIndex()
    const existing = entries.findIndex(e => e.noteId === entry.noteId)
    if (existing >= 0) entries[existing] = entry
    else entries.push(entry)
    await api.updateNote(m.indexId, { content: serializeIndex(entries) })
    return entries
  }

  async function appendLog(operation: string, title: string): Promise<void> {
    const m = await ensureMeta()
    const note = await api.getNote(m.logId)
    const updated = (note.content ?? '') + formatLogEntry(operation, title)
    await api.updateNote(m.logId, { content: updated })
  }

  async function readPages(noteIds: string[]): Promise<Map<string, string>> {
    const results = await Promise.all(
      noteIds.map(id => api.getNote(id).then(n => [id, n.content ?? ''] as const)),
    )
    return new Map(results)
  }

  return {
    async startSession(): Promise<WikiSession> {
      const m = await ensureMeta()
      const [schema, index, log] = await Promise.all([
        api.getNote(m.schemaId),
        api.getNote(m.indexId),
        api.getNote(m.logId),
      ])
      return {
        schema:    schema.content ?? '',
        index:     parseIndex(index.content ?? ''),
        recentLog: parseRecentLog(log.content ?? ''),
      }
    },

    async createPage(
      type: WikiNoteType,
      title: string,
      content: string,
      summary: string,
    ): Promise<CreatePageResult> {
      await ensureMeta()
      const note = await api.createNote({
        title:           `[${type}] ${title}`,
        content,
        readPermission:  'owner',
        writePermission: 'owner',
      })
      const [entries] = await Promise.all([
        addToIndex({ noteId: note.id, type, title, summary }),
        appendLog('create', title),
      ])
      return { noteId: note.id, indexSize: entries.length }
    },

    async updatePage(noteId: string, content: string): Promise<void> {
      await ensureMeta()
      await api.updateNote(noteId, { content })
      await appendLog('update', noteId)
    },

    async readPage(noteId: string): Promise<string> {
      const note = await api.getNote(noteId)
      return note.content ?? ''
    },

    readPages,

    async searchIndex(query: string): Promise<WikiIndexEntry[]> {
      const q = query.toLowerCase()
      const entries = await getIndex()
      return entries.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q),
      )
    },

    async lint(): Promise<LintReport> {
      const entries = await getIndex()
      const allContent = await readPages(entries.map(e => e.noteId))

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
    },
  }
}

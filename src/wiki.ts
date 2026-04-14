import HackMDAPI from '@hackmd/api'

import { serializeIndex, parseIndex, formatLogEntry, parseRecentLog } from './parser.ts'
import type { WikiMeta, WikiNoteType, WikiIndexEntry, WikiSession, LintReport } from './types.ts'

const SCHEMA_TITLE = '[meta] schema'
const INDEX_TITLE  = '[meta] index'
const LOG_TITLE    = '[meta] log'

export interface WikiClient {
  createTeamNote(teamPath: string, opts: Record<string, unknown>): Promise<{ id: string; content?: string }>
  getNote(id: string): Promise<{ id: string; content?: string }>
  updateTeamNote(teamPath: string, id: string, opts: Record<string, unknown>): Promise<unknown>
}


export interface WikiConfig {
  token: string
  teamPath: string
  apiUrl?: string
}

export interface CreatePageResult {
  noteId: string
  indexSize: number
}

export interface Wiki {
  bootstrap(initialSchema?: string): Promise<WikiMeta>
  load(meta: WikiMeta): void
  startSession(): Promise<WikiSession>
  createPage(type: WikiNoteType, title: string, content: string, summary: string): Promise<CreatePageResult>
  updatePage(noteId: string, content: string): Promise<void>
  readPage(noteId: string): Promise<string>
  readPages(noteIds: string[]): Promise<Map<string, string>>
  searchIndex(query: string): Promise<WikiIndexEntry[]>
  appendLog(operation: string, title: string): Promise<void>
  lint(): Promise<LintReport>
}

export function createWiki(config: WikiConfig, client?: WikiClient): Wiki {
  const api: WikiClient = client ?? (new HackMDAPI(
    config.token,
    config.apiUrl ?? 'https://api.hackmd.io/v1',
  ) as unknown as WikiClient)

  const teamPath = config.teamPath
  let meta: WikiMeta | null = null

  function assertMeta(): WikiMeta {
    if (!meta) throw new Error('Call bootstrap() or load() first.')
    return meta
  }

  async function getIndex(): Promise<WikiIndexEntry[]> {
    const m = assertMeta()
    const note = await api.getNote(m.indexId)
    return parseIndex(note.content ?? '')
  }

  async function addToIndex(entry: WikiIndexEntry): Promise<WikiIndexEntry[]> {
    const m = assertMeta()
    const entries = await getIndex()
    const existing = entries.findIndex(e => e.noteId === entry.noteId)
    if (existing >= 0) entries[existing] = entry
    else entries.push(entry)
    await api.updateTeamNote(teamPath, m.indexId, { content: serializeIndex(entries) })
    return entries
  }

  async function appendLog(operation: string, title: string): Promise<void> {
    const m = assertMeta()
    const note = await api.getNote(m.logId)
    const updated = (note.content ?? '') + formatLogEntry(operation, title)
    await api.updateTeamNote(teamPath, m.logId, { content: updated })
  }

  async function readPages(noteIds: string[]): Promise<Map<string, string>> {
    const results = await Promise.all(
      noteIds.map(id => api.getNote(id).then(n => [id, n.content ?? ''] as const)),
    )
    return new Map(results)
  }

  return {
    async bootstrap(initialSchema = '# Schema\n\n_Fill this in._'): Promise<WikiMeta> {
      const [schema, index, log] = await Promise.all([
        api.createTeamNote(teamPath, {
          title:           SCHEMA_TITLE,
          content:         initialSchema,
          readPermission:  'owner',
          writePermission: 'owner',
        }),
        api.createTeamNote(teamPath, {
          title:           INDEX_TITLE,
          content:         serializeIndex([]),
          readPermission:  'owner',
          writePermission: 'owner',
        }),
        api.createTeamNote(teamPath, {
          title:           LOG_TITLE,
          content:         '# Log\n',
          readPermission:  'owner',
          writePermission: 'owner',
        }),
      ])
      meta = { schemaId: schema.id, indexId: index.id, logId: log.id }
      return meta
    },

    load(m: WikiMeta): void {
      meta = m
    },

    async startSession(): Promise<WikiSession> {
      const m = assertMeta()
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
      assertMeta()
      const note = await api.createTeamNote(teamPath, {
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
      assertMeta()
      await api.updateTeamNote(teamPath, noteId, { content })
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

    appendLog,

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

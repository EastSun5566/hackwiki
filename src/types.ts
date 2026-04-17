export type WikiNoteType = 'raw' | 'concept' | 'entity' | 'synthesis'

export interface WikiIndexEntry {
  noteId: string
  type: WikiNoteType
  title: string
  summary: string
}

export interface WikiSession {
  schema: string
  index: WikiIndexEntry[]
  recentLog: string[]
}

export interface LintReport {
  orphanPages: WikiIndexEntry[]
  undocumentedMentions: string[]
}

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

export interface Wiki {
  startSession(): Promise<WikiSession>
  createPage(type: WikiNoteType, title: string, content: string, summary: string): Promise<{ noteId: string; indexSize: number }>
  updatePage(noteId: string, content: string): Promise<void>
  readPage(noteId: string): Promise<string>
  readPages(noteIds: string[]): Promise<Map<string, string>>
  searchIndex(query: string): Promise<WikiIndexEntry[]>
  lint(): Promise<LintReport>
}

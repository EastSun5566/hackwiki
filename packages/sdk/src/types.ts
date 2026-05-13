export interface NoteSummary {
  id: string
  title?: string
  tags?: string[]
  folderPaths?: FolderPath[]
}

export interface FolderPath {
  id?: string
  name: string
  icon?: string | null
  color?: string | null
  parentId?: string | null
  clientId: string
}

export interface NoteDetails extends NoteSummary {
  content?: string
}

export interface FolderSummary {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  parentFolderId: string | null
  createdAt: number
  updatedAt: number
}

export type NotePermissionRole = 'owner' | 'signed_in' | 'guest'

export interface CreateNoteOptions {
  title?: string
  content?: string
  description?: string
  tags?: string[]
  readPermission?: NotePermissionRole
  writePermission?: NotePermissionRole
  parentFolderId?: string
}

export interface UpdateNoteOptions {
  title?: string
  content?: string
  description?: string
  tags?: string[]
  readPermission?: NotePermissionRole
  writePermission?: NotePermissionRole
  parentFolderId?: string
}

export interface CreateFolderOptions {
  name: string
  description?: string
  icon?: string
  color?: string
  parentFolderId?: string
}

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

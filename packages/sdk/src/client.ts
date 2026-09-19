import type {
  NoteSummary,
  NoteDetails,
  CreateNoteOptions,
  UpdateNoteOptions,
  FolderSummary,
  CreateFolderOptions,
} from './types.ts'

const DEFAULT_API_URL = 'https://api.hackmd.io/v1'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

export interface WikiClient {
  getNoteList(): Promise<NoteSummary[]>
  createNote(opts: CreateNoteOptions): Promise<NoteDetails>
  getNote(id: string): Promise<NoteDetails>
  updateNote(id: string, opts: UpdateNoteOptions): Promise<unknown>
  deleteNote(id: string): Promise<void>
  getFolderList(): Promise<FolderSummary[]>
  createFolder(opts: CreateFolderOptions): Promise<FolderSummary>
}

export class HackMDClient implements WikiClient {
  private readonly token: string
  private readonly apiUrl: string
  private readonly teamPath?: string

  constructor(
    token: string,
    apiUrl = DEFAULT_API_URL,
    teamPath?: string,
  ) {
    if (!token) {
      throw new Error('Missing access token when creating HackMD client')
    }

    this.token = token
    this.apiUrl = apiUrl.replace(/\/+$/, '')
    this.teamPath = teamPath
  }

  private workspacePath(path: string): string {
    const prefix = this.teamPath
      ? `/teams/${encodeURIComponent(this.teamPath)}`
      : ''
    return `${prefix}${path}`
  }

  async getNoteList(): Promise<NoteSummary[]> {
    return this.request<NoteSummary[]>(this.workspacePath('/notes'))
  }

  async createNote(opts: CreateNoteOptions): Promise<NoteDetails> {
    return this.request<NoteDetails>(this.workspacePath('/notes'), { method: 'POST', body: opts })
  }

  async getNote(id: string): Promise<NoteDetails> {
    return this.request<NoteDetails>(this.workspacePath(`/notes/${encodeURIComponent(id)}`))
  }

  async updateNote(id: string, opts: UpdateNoteOptions): Promise<unknown> {
    return this.request(this.workspacePath(`/notes/${encodeURIComponent(id)}`), { method: 'PATCH', body: opts })
  }

  async deleteNote(id: string): Promise<void> {
    return this.request(this.workspacePath(`/notes/${encodeURIComponent(id)}`), { method: 'DELETE' })
  }

  async getFolderList(): Promise<FolderSummary[]> {
    return this.request<FolderSummary[]>(this.workspacePath('/folders'))
  }

  async createFolder(opts: CreateFolderOptions): Promise<FolderSummary> {
    return this.request<FolderSummary>(this.workspacePath('/folders'), { method: 'POST', body: opts })
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization:  `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })

    const text = await response.text()
    if (!response.ok) {
      const detail = text ? `: ${text}` : ''
      throw new Error(`HackMD request failed (${response.status} ${response.statusText})${detail}`)
    }
    if (!text) {
      return undefined as T
    }

    try {
      return JSON.parse(text) as T
    } catch {
      return text as T
    }
  }
}

export function createClient(token: string, apiUrl?: string, teamPath?: string) {
  return new HackMDClient(token, apiUrl, teamPath)
}

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
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

export interface WikiClient {
  getNoteList(): Promise<NoteSummary[]>
  createNote(opts: CreateNoteOptions): Promise<NoteDetails>
  getNote(id: string): Promise<NoteDetails>
  updateNote(id: string, opts: UpdateNoteOptions): Promise<unknown>
  getFolderList(): Promise<FolderSummary[]>
  createFolder(opts: CreateFolderOptions): Promise<FolderSummary>
}

export class HackMDClient implements WikiClient {
  private readonly token: string
  private readonly apiUrl: string

  constructor(
    token: string,
    apiUrl = DEFAULT_API_URL,
  ) {
    if (!token) {
      throw new Error('Missing access token when creating HackMD client')
    }

    this.token = token
    this.apiUrl = apiUrl.replace(/\/+$/, '')
  }

  async getNoteList(): Promise<NoteSummary[]> {
    return this.request<NoteSummary[]>('/notes')
  }

  async createNote(opts: CreateNoteOptions): Promise<NoteDetails> {
    return this.request<NoteDetails>('/notes', { method: 'POST', body: opts })
  }

  async getNote(id: string): Promise<NoteDetails> {
    return this.request<NoteDetails>(`/notes/${encodeURIComponent(id)}`)
  }

  async updateNote(id: string, opts: UpdateNoteOptions): Promise<unknown> {
    return this.request(`/notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: opts })
  }

  async getFolderList(): Promise<FolderSummary[]> {
    return this.request<FolderSummary[]>('/folders')
  }

  async createFolder(opts: CreateFolderOptions): Promise<FolderSummary> {
    return this.request<FolderSummary>('/folders', { method: 'POST', body: opts })
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

export function createClient(token: string, apiUrl?: string) {
  return new HackMDClient(token, apiUrl)
}

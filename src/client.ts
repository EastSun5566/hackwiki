import type { NoteSummary } from "./types.ts"

const DEFAULT_API_URL = 'https://api.hackmd.io/v1'

type Note = {
  id: string
  title?: string
  content?: string
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
}

export class HackMDClient {
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

  async createNote(opts: Record<string, unknown>): Promise<Note> {
    return this.request<Note>('/notes', { method: 'POST', body: opts })
  }

  async getNote(id: string): Promise<Note> {
    return this.request<Note>(`/notes/${encodeURIComponent(id)}`)
  }

  async updateNote(id: string, opts: Record<string, unknown>): Promise<unknown> {
    return this.request(`/notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: opts })
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

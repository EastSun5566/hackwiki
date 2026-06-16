import type { WikiIndexEntry, WikiNoteType } from './types.ts'

const SECTION_ORDER: WikiNoteType[] = ['raw', 'concept', 'entity', 'synthesis']
const INDEX_FENCE_LANGUAGE = 'hackwiki-index'
const INDEX_FENCE_RE = /```hackwiki-index\n([\s\S]*?)\n```/m

const SECTION_LABEL: Record<WikiNoteType, string> = {
  raw:       'Raw Sources',
  concept:   'Concepts',
  entity:    'Entities',
  synthesis: 'Synthesis',
}

function isWikiNoteType(value: unknown): value is WikiNoteType {
  return value === 'raw' || value === 'concept' || value === 'entity' || value === 'synthesis'
}

function isIndexEntry(value: unknown): value is WikiIndexEntry {
  if (!value || typeof value !== 'object') return false

  const entry = value as Record<string, unknown>
  return (
    typeof entry.noteId === 'string' &&
    isWikiNoteType(entry.type) &&
    typeof entry.title === 'string' &&
    typeof entry.summary === 'string'
  )
}

export function serializeIndex(entries: WikiIndexEntry[]): string {
  const machineReadable = [
    `\`\`\`${INDEX_FENCE_LANGUAGE}`,
    JSON.stringify(entries, null, 2),
    '```',
  ].join('\n')

  const sections = SECTION_ORDER.map(type => {
    const group = entries.filter(e => e.type === type)
    if (!group.length) return ''
    const lines = group.map(e =>
      `- [${e.type}] ${e.title} \`${e.noteId}\` — ${e.summary}`
    )
    return `## ${SECTION_LABEL[type]}\n${lines.join('\n')}`
  })
  const readable = sections.filter(Boolean).join('\n\n')
  return readable
    ? `# Index\n\n${machineReadable}\n\n${readable}`
    : `# Index\n\n${machineReadable}`
}

export function parseIndex(markdown: string): WikiIndexEntry[] {
  const machineMatch = markdown.match(INDEX_FENCE_RE)
  if (machineMatch) {
    try {
      const parsed = JSON.parse(machineMatch[1]) as unknown
      if (Array.isArray(parsed) && parsed.every(isIndexEntry)) {
        return parsed
      }
    } catch {
      // Fall through to the legacy markdown parser.
    }
  }

  const entries: WikiIndexEntry[] = []
  const re = /^- \[(\w+)\] (.+?) `([^`]+)` — (.+)$/gm
  for (const m of markdown.matchAll(re)) {
    if (!isWikiNoteType(m[1])) continue
    entries.push({
      type:    m[1],
      title:   m[2],
      noteId:  m[3],
      summary: m[4],
    })
  }
  return entries
}

export function formatLogEntry(operation: string, title: string): string {
  const date = new Date().toISOString().split('T')[0]
  return `\n## [${date}] ${operation} | ${title}`
}

export function parseRecentLog(markdown: string, n = 5): string[] {
  return [...markdown.matchAll(/^## \[.+$/gm)]
    .map(m => m[0])
    .slice(-n)
}

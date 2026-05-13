import type { WikiIndexEntry, WikiNoteType } from './types.ts'

const SECTION_ORDER: WikiNoteType[] = ['raw', 'concept', 'entity', 'synthesis']

const SECTION_LABEL: Record<WikiNoteType, string> = {
  raw:       'Raw Sources',
  concept:   'Concepts',
  entity:    'Entities',
  synthesis: 'Synthesis',
}

export function serializeIndex(entries: WikiIndexEntry[]): string {
  const sections = SECTION_ORDER.map(type => {
    const group = entries.filter(e => e.type === type)
    if (!group.length) return ''
    const lines = group.map(e =>
      `- [${e.type}] ${e.title} \`${e.noteId}\` — ${e.summary}`
    )
    return `## ${SECTION_LABEL[type]}\n${lines.join('\n')}`
  })
  return `# Index\n\n${sections.filter(Boolean).join('\n\n')}`
}

export function parseIndex(markdown: string): WikiIndexEntry[] {
  const entries: WikiIndexEntry[] = []
  const re = /^- \[(\w+)\] (.+?) `([^`]+)` — (.+)$/gm
  for (const m of markdown.matchAll(re)) {
    entries.push({
      type:    m[1] as WikiNoteType,
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

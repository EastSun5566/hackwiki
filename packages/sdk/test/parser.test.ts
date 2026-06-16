import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { serializeIndex, parseIndex, formatLogEntry, parseRecentLog } from '../src/parser.ts'
import type { WikiIndexEntry } from '../src/types.ts'

describe('parseIndex / serializeIndex', () => {
  const entries: WikiIndexEntry[] = [
    { noteId: 'abc', type: 'raw',     title: 'Paper 1',      summary: 'A foundational paper' },
    { noteId: 'def', type: 'concept', title: 'RAG',          summary: 'Retrieval Augmented Generation' },
    { noteId: 'ghi', type: 'entity',  title: 'OpenAI',       summary: 'AI research company' },
    { noteId: 'jkl', type: 'synthesis', title: 'RAG vs Wiki', summary: 'Comparison of approaches' },
  ]

  it('round-trips through serialize → parse', () => {
    const md = serializeIndex(entries)
    const parsed = parseIndex(md)
    assert.deepEqual(parsed, entries)
  })

  it('serializes a machine-readable JSON block', () => {
    const md = serializeIndex(entries)
    assert.ok(md.includes('```hackwiki-index'))
    assert.ok(md.includes('"noteId": "abc"'))
  })

  it('prefers the machine-readable JSON block over the readable list', () => {
    const md = [
      '# Index',
      '',
      '```hackwiki-index',
      JSON.stringify([entries[0]], null, 2),
      '```',
      '',
      '- [concept] Stale `old` — old summary',
    ].join('\n')

    assert.deepEqual(parseIndex(md), [entries[0]])
  })

  it('falls back to the legacy markdown format when JSON is missing', () => {
    const md = '# Index\n\n- [concept] RAG `def` — Retrieval Augmented Generation'
    assert.deepEqual(parseIndex(md), [entries[1]])
  })

  it('falls back to the legacy markdown format when JSON is invalid', () => {
    const md = [
      '# Index',
      '',
      '```hackwiki-index',
      '{not json',
      '```',
      '',
      '- [entity] OpenAI `ghi` — AI research company',
    ].join('\n')

    assert.deepEqual(parseIndex(md), [entries[2]])
  })

  it('groups entries under correct section headings', () => {
    const md = serializeIndex(entries)
    assert.ok(md.includes('## Raw Sources'))
    assert.ok(md.includes('## Concepts'))
    assert.ok(md.includes('## Entities'))
    assert.ok(md.includes('## Synthesis'))
  })

  it('omits sections with no entries', () => {
    const md = serializeIndex([{ noteId: 'x', type: 'concept', title: 'X', summary: 'y' }])
    assert.ok(!md.includes('## Raw Sources'))
    assert.ok(md.includes('## Concepts'))
  })

  it('returns empty array for empty / blank index', () => {
    assert.deepEqual(parseIndex(serializeIndex([])), [])
    assert.deepEqual(parseIndex(''), [])
  })

  it('preserves SECTION_ORDER: raw → concept → entity → synthesis', () => {
    const md = serializeIndex(entries)
    const rawPos      = md.indexOf('## Raw Sources')
    const conceptPos  = md.indexOf('## Concepts')
    const entityPos   = md.indexOf('## Entities')
    const synthPos    = md.indexOf('## Synthesis')
    assert.ok(rawPos < conceptPos)
    assert.ok(conceptPos < entityPos)
    assert.ok(entityPos < synthPos)
  })
})

describe('formatLogEntry', () => {
  it('contains operation and title', () => {
    const entry = formatLogEntry('create', 'My Note')
    assert.ok(entry.includes('create'))
    assert.ok(entry.includes('My Note'))
  })

  it('includes today\'s date in YYYY-MM-DD format', () => {
    const today = new Date().toISOString().split('T')[0]
    const entry = formatLogEntry('ingest', 'Test Article')
    assert.ok(entry.includes(today), `Expected entry to contain ${today}, got: ${entry}`)
  })

  it('matches the ## [date] op | title pattern', () => {
    const entry = formatLogEntry('update', 'Some Page')
    assert.match(entry, /^## \[\d{4}-\d{2}-\d{2}\] update \| Some Page$/m)
  })
})

describe('parseRecentLog', () => {
  const log = [
    '# Log',
    '## [2026-01-01] ingest | Article A',
    '## [2026-01-02] create | Note B',
    '## [2026-01-03] update | Note C',
    '## [2026-01-04] ingest | Article D',
    '## [2026-01-05] ingest | Article E',
    '## [2026-01-06] ingest | Article F',
  ].join('\n')

  it('returns the last N entries (default 5)', () => {
    const recent = parseRecentLog(log)
    assert.equal(recent.length, 5)
    assert.ok(recent[4].includes('Article F'))
  })

  it('respects custom n', () => {
    const recent = parseRecentLog(log, 3)
    assert.equal(recent.length, 3)
    assert.ok(recent[0].includes('Article D'))
    assert.ok(recent[2].includes('Article F'))
  })

  it('returns empty array for empty log', () => {
    assert.deepEqual(parseRecentLog('# Log\n'), [])
  })
})

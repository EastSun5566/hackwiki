import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createWiki, type WikiClient } from '../src/index.ts'

const RESERVED_TITLES = ['[hackwiki] schema', '[hackwiki] index', '[hackwiki] log']
const HACKWIKI_TAG = 'hackwiki'

type MockWikiClient = WikiClient & {
  getCreateCalls(): Record<string, unknown>[]
}

function createMockClient(): MockWikiClient {
  const store = new Map<string, { id: string; title?: string; content: string }>()
  const createCalls: Record<string, unknown>[] = []
  let counter = 0

  return {
    async getNoteList() {
      return [...store.values()].map(note => ({ id: note.id, title: note.title }))
    },

    async createNote(opts) {
      const id = `id-${++counter}`
      createCalls.push({
        ...opts,
        tags: Array.isArray(opts.tags) ? [...(opts.tags as string[])] : opts.tags,
      })
      store.set(id, {
        id,
        title:   opts.title as string | undefined,
        content: (opts.content as string) ?? '',
      })
      return { id, content: (opts.content as string) ?? '' }
    },

    async getNote(id) {
      const note = store.get(id)
      if (!note) throw new Error(`Note not found: ${id}`)
      return note
    },

    async updateNote(id, opts) {
      const note = store.get(id)
      if (!note) throw new Error(`Note not found: ${id}`)
      if (typeof opts.content === 'string') note.content = opts.content
      return {}
    },

    getCreateCalls() {
      return createCalls
    },
  }
}

async function makeWiki() {
  const mock = createMockClient()
  return createWiki({ token: 'test-token' }, mock)
}

describe('initialization', () => {
  it('auto-initializes the reserved notes on first use', async () => {
    const mock = createMockClient()
    const wiki = createWiki({ token: 'tok' }, mock)
    const session = await wiki.startSession()
    const notes = await mock.getNoteList()
    const createCalls = mock.getCreateCalls()

    assert.equal(session.schema, '# Schema\n\n_Fill this in._')
    assert.deepEqual(session.index, [])
    assert.deepEqual(session.recentLog, [])
    assert.equal(notes.length, 3)
    assert.deepEqual(notes.map(note => note.title).sort(), [...RESERVED_TITLES].sort())
    assert.equal(createCalls.length, 3)
    for (const call of createCalls) {
      assert.deepEqual(call.tags, [HACKWIKI_TAG])
    }
  })

  it('reuses the same reserved notes across repeated operations', async () => {
    const mock = createMockClient()
    const wiki = createWiki({ token: 'tok' }, mock)

    await wiki.startSession()
    const before = await mock.getNoteList()

    await wiki.startSession()
    const after = await mock.getNoteList()

    assert.equal(before.length, 3)
    assert.equal(after.length, 3)
  })

  it('discovers existing reserved notes in a new wiki instance', async () => {
    const mock = createMockClient()
    const first = createWiki({ token: 'tok' }, mock)
    await first.startSession()
    const before = await mock.getNoteList()

    const second = createWiki({ token: 'tok' }, mock)
    const session = await second.startSession()
    const after = await mock.getNoteList()

    assert.equal(before.length, 3)
    assert.equal(after.length, 3)
    assert.equal(session.schema, '# Schema\n\n_Fill this in._')
  })

  it('uses initialSchema on first creation', async () => {
    const mock = createMockClient()
    const wiki = createWiki({ token: 'tok', initialSchema: '# My Custom Schema' }, mock)

    const session = await wiki.startSession()
    assert.equal(session.schema, '# My Custom Schema')
  })

  it('does not overwrite existing schema in later instances', async () => {
    const mock = createMockClient()
    const first = createWiki({ token: 'tok', initialSchema: '# First Schema' }, mock)
    await first.startSession()

    const second = createWiki({ token: 'tok', initialSchema: '# Second Schema' }, mock)
    const session = await second.startSession()

    assert.equal(session.schema, '# First Schema')
  })

  it('throws when duplicate reserved note titles exist', async () => {
    const mock = createMockClient()
    await mock.createNote({ title: '[hackwiki] schema', content: '# A' })
    await mock.createNote({ title: '[hackwiki] schema', content: '# B' })

    const wiki = createWiki({ token: 'tok' }, mock)
    await assert.rejects(() => wiki.startSession(), /multiple reserved notes/i)
  })
})

describe('startSession', () => {
  it('returns empty index and empty recentLog for a fresh wiki', async () => {
    const wiki = await makeWiki()
    const session = await wiki.startSession()
    assert.deepEqual(session.index, [])
    assert.deepEqual(session.recentLog, [])
  })

  it('returns the schema content', async () => {
    const mock = createMockClient()
    const wiki = createWiki({ token: 'tok', initialSchema: '# Schema v1' }, mock)
    const { schema } = await wiki.startSession()
    assert.equal(schema, '# Schema v1')
  })
})

describe('createPage', () => {
  it('returns a noteId and indexSize of 1 for the first page', async () => {
    const wiki = await makeWiki()
    const result = await wiki.createPage('concept', 'Self-Attention', '# Self-Attention\n\ncontent', 'Q/K/V mechanism')

    assert.ok(result.noteId)
    assert.equal(result.indexSize, 1)
  })

  it('increments indexSize with each subsequent page', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('raw',     'Paper A', '# Paper A', 'source paper')
    await wiki.createPage('concept', 'Concept B', '# B', 'a concept')
    const result = await wiki.createPage('entity', 'Entity C', '# C', 'an entity')

    assert.equal(result.indexSize, 3)
  })

  it('the new page appears in the index after creation', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'RAG', '# RAG', 'Retrieval-Augmented Generation')

    const { index } = await wiki.startSession()
    assert.equal(index.length, 1)
    assert.equal(index[0].title, 'RAG')
    assert.equal(index[0].type,  'concept')
    assert.equal(index[0].summary, 'Retrieval-Augmented Generation')
  })

  it('tags newly created wiki pages for dashboard visibility', async () => {
    const mock = createMockClient()
    const wiki = createWiki({ token: 'tok' }, mock)

    await wiki.createPage('concept', 'RAG', '# RAG', 'Retrieval-Augmented Generation')

    assert.deepEqual(mock.getCreateCalls().at(-1)?.tags, [HACKWIKI_TAG])
  })

  it('appends a create entry to recentLog', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'RAG', '# RAG', 'Retrieval-Augmented Generation')

    const { recentLog } = await wiki.startSession()
    assert.equal(recentLog.length, 1)
    assert.match(recentLog[0], /create \| RAG$/)
  })
})

describe('updatePage', () => {
  it('overwrites the page content', async () => {
    const wiki = await makeWiki()
    const { noteId } = await wiki.createPage('concept', 'RAG', '# RAG\n\nv1', 'RAG description')

    await wiki.updatePage(noteId, '# RAG\n\nv2 — updated content')

    const content = await wiki.readPage(noteId)
    assert.ok(content.includes('v2 — updated content'), 'expected updated content')
    assert.ok(!content.includes('v1'), 'old content should be gone')
  })

  it('appends an update entry to recentLog', async () => {
    const wiki = await makeWiki()
    const { noteId } = await wiki.createPage('concept', 'RAG', '# RAG\n\nv1', 'RAG description')

    await wiki.updatePage(noteId, '# RAG\n\nv2 — updated content')

    const { recentLog } = await wiki.startSession()
    assert.equal(recentLog.length, 2)
    assert.match(recentLog[1], new RegExp(`update \\| ${noteId}$`))
  })
})

describe('readPage', () => {
  it('returns the note content by id', async () => {
    const wiki = await makeWiki()
    const { noteId } = await wiki.createPage('raw', 'Article', '# Article\n\nfull text here', 'summary')
    const content = await wiki.readPage(noteId)
    assert.ok(content.includes('full text here'))
  })
})

describe('readPages', () => {
  it('returns a Map of noteId → content', async () => {
    const wiki = await makeWiki()
    const r1 = await wiki.createPage('concept', 'Alpha', '# Alpha content', 's')
    const r2 = await wiki.createPage('concept', 'Beta',  '# Beta content',  's')

    const pages = await wiki.readPages([r1.noteId, r2.noteId])

    assert.equal(pages.size, 2)
    assert.ok(pages.get(r1.noteId)?.includes('Alpha content'))
    assert.ok(pages.get(r2.noteId)?.includes('Beta content'))
  })

  it('returns empty map for empty array', async () => {
    const wiki = await makeWiki()
    const pages = await wiki.readPages([])
    assert.equal(pages.size, 0)
  })
})

describe('searchIndex', () => {
  it('matches on title (case-insensitive)', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'Self-Attention', '# Self-Attention', 'Q/K/V mechanism')
    await wiki.createPage('raw',     'BERT Paper',     '# BERT',           'bidirectional encoder')

    const hits = await wiki.searchIndex('attention')
    assert.equal(hits.length, 1)
    assert.equal(hits[0].title, 'Self-Attention')
  })

  it('matches on summary', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('raw', 'Transformer Paper', '# Trans', 'attention is all you need')

    const hits = await wiki.searchIndex('attention')
    assert.equal(hits.length, 1)
  })

  it('returns all matching entries across both fields', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'Self-Attention', '#', 'Q/K/V')
    await wiki.createPage('raw',     'Transformer',    '#', 'uses attention mechanism')

    const hits = await wiki.searchIndex('attention')
    assert.equal(hits.length, 2)
  })

  it('returns empty array when nothing matches', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'BERT', '# BERT', 'bidirectional encoder')

    const hits = await wiki.searchIndex('transformer')
    assert.equal(hits.length, 0)
  })
})

describe('lint', () => {
  it('flags non-raw pages with no inbound references as orphans', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'Orphan Concept', '# Orphan\n\nno one links here', 'isolated')

    const { orphanPages } = await wiki.lint()
    assert.ok(orphanPages.some(p => p.title === 'Orphan Concept'))
  })

  it('does NOT flag raw pages as orphans', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('raw', 'Source Paper', '# Source', 'raw source')

    const { orphanPages } = await wiki.lint()
    assert.equal(orphanPages.filter(p => p.title === 'Source Paper').length, 0)
  })

  it('does NOT flag a concept page that is linked from another page', async () => {
    const wiki = await makeWiki()
    const { noteId } = await wiki.createPage('concept', 'Linked Concept', '# Linked', 'summary')
    await wiki.createPage('concept', 'Parent Page', `# Parent\n\nSee [Linked Concept](${noteId})`, 'refs linked')

    const { orphanPages } = await wiki.lint()
    assert.equal(orphanPages.filter(p => p.title === 'Linked Concept').length, 0)
  })

  it('detects [[Title]] mentions not present in the index', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'Known Page', '# Known\n\nSee [[Unknown Topic]] and [[Missing Entry]]', 'mentions unknowns')

    const { undocumentedMentions } = await wiki.lint()
    assert.ok(undocumentedMentions.includes('Unknown Topic'))
    assert.ok(undocumentedMentions.includes('Missing Entry'))
  })

  it('does NOT flag [[Title]] when the title exists in the index', async () => {
    const wiki = await makeWiki()
    await wiki.createPage('concept', 'RAG',        '# RAG',                         'retrieval')
    await wiki.createPage('concept', 'Wiki Index', '# Wiki Index\n\nSee [[RAG]]',   'index page')

    const { undocumentedMentions } = await wiki.lint()
    assert.equal(undocumentedMentions.filter(t => t === 'RAG').length, 0)
  })

  it('returns empty report for a fresh wiki', async () => {
    const wiki = await makeWiki()
    const report = await wiki.lint()
    assert.deepEqual(report.orphanPages, [])
    assert.deepEqual(report.undocumentedMentions, [])
  })
})

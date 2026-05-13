import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  runCliWithDeps,
  type CliDeps,
  type CliWiki,
  type CliWikiSession,
  type CliLintReport,
  type CliCreatePageResult,
  type CliWikiNoteType,
} from '../src/runner.ts'

type CapturedOutput = {
  stdout: string[]
  stderr: string[]
}

function createOutput() {
  return {
    stdout: [],
    stderr: [],
  } satisfies CapturedOutput
}

function createWikiStub(overrides: Partial<CliWiki> = {}): CliWiki {
  return {
    async startSession(): Promise<CliWikiSession> {
      return {
        schema: '# Schema',
        index: [],
        recentLog: [],
      }
    },
    async createPage(
      _type: CliWikiNoteType,
      _title: string,
      _content: string,
      _summary: string,
    ): Promise<CliCreatePageResult> {
      return {
        noteId: 'note-1',
        indexSize: 1,
      }
    },
    async updatePage(): Promise<void> {},
    async readPage(): Promise<string> {
      return '# Page'
    },
    async searchIndex() {
      return []
    },
    async lint(): Promise<CliLintReport> {
      return {
        orphanPages: [],
        undocumentedMentions: [],
      }
    },
    ...overrides,
  }
}

function createDependencies(
  wiki: CliWiki,
  output: CapturedOutput,
  env: Record<string, string | undefined> = { HACKMD_TOKEN: 'tok' },
): CliDeps {
  return {
    createWiki() {
      return wiki
    },
    env,
    async readFile(filePath) {
      if (filePath === '/tmp/page.md') return '# From file'
      throw new Error(`unexpected file read: ${filePath}`)
    },
    stdout(text) {
      output.stdout.push(text)
    },
    stderr(text) {
      output.stderr.push(text)
    },
  }
}

describe('runCliWithDependencies', () => {
  it('prints session data as JSON', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async startSession() {
        return {
          schema: '# Schema',
          index: [{ noteId: 'note-1', type: 'concept', title: 'RAG', summary: 'retrieval' }],
          recentLog: ['## [2026-05-14] create | RAG'],
        }
      },
    })

    const exitCode = await runCliWithDeps(
      ['session', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.equal(output.stderr.join(''), '')
    const json = JSON.parse(output.stdout.join(''))
    assert.equal(json.schema, '# Schema')
    assert.equal(json.index.length, 1)
    assert.equal(json.recentLog.length, 1)
  })

  it('creates a page from inline content', async () => {
    const output = createOutput()
    const calls: Array<{ type: string; title: string; content: string; summary: string }> = []
    const wiki = createWikiStub({
      async createPage(type, title, content, summary) {
        calls.push({ type, title, content, summary })
        return {
          noteId: 'note-42',
          indexSize: 7,
        }
      },
    })

    const exitCode = await runCliWithDeps(
      ['page', 'create', 'concept', 'RAG', '--summary', 'retrieval', '--content', '# RAG', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(calls, [{
      type: 'concept',
      title: 'RAG',
      content: '# RAG',
      summary: 'retrieval',
    }])
    const json = JSON.parse(output.stdout.join(''))
    assert.equal(json.noteId, 'note-42')
    assert.equal(json.indexSize, 7)
  })

  it('updates a page from a file path', async () => {
    const output = createOutput()
    const calls: Array<{ noteId: string; content: string }> = []
    const wiki = createWikiStub({
      async updatePage(noteId, content) {
        calls.push({ noteId, content })
      },
    })

    const exitCode = await runCliWithDeps(
      ['page', 'update', 'note-99', '--file', '/tmp/page.md', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(calls, [{ noteId: 'note-99', content: '# From file' }])
    const json = JSON.parse(output.stdout.join(''))
    assert.deepEqual(json, { success: true, noteId: 'note-99' })
  })

  it('returns a usage error when HACKMD_TOKEN is missing', async () => {
    const output = createOutput()
    const exitCode = await runCliWithDeps(
      ['session'],
      createDependencies(createWikiStub(), output, {}),
    )

    assert.equal(exitCode, 1)
    assert.match(output.stderr.join(''), /missing hackmd_token/i)
  })
})

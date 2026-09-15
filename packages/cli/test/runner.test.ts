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

type WikiConfigCall = {
  token: string
  apiUrl?: string
}

const TEST_HOME = '/home/test'
const HACKMD_CONFIG_PATH = `${TEST_HOME}/.hackmd/config.json`

function createOutput() {
  return {
    stdout: [],
    stderr: [],
  } satisfies CapturedOutput
}

function createWikiStub(overrides: Partial<CliWiki> = {}): CliWiki {
  return {
    async initialize(): Promise<CliWikiSession> {
      return { schema: '# Schema', index: [], recentLog: [] }
    },
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
    async findIndexedPage() {
      return undefined
    },
    async listPages() {
      return []
    },
    async searchIndex() {
      return []
    },
    async lint(): Promise<CliLintReport> {
      return {
        orphanPages: [],
        undocumentedMentions: [],
        issues: [],
      }
    },
    async readSchema() {
      return '# Schema'
    },
    async updateSchema(): Promise<void> {},
    async readIndex() {
      return []
    },
    async readLog() {
      return '# Log'
    },
    async appendLog(): Promise<void> {},
    ...overrides,
  }
}

function createDependencies(
  wiki: CliWiki,
  output: CapturedOutput,
  env: Record<string, string | undefined> = { HMD_API_ACCESS_TOKEN: 'tok' },
  files: Record<string, string> = {},
  wikiConfigCalls: WikiConfigCall[] = [],
): CliDeps {
  return {
    createWiki(config) {
      wikiConfigCalls.push(config)
      return wiki
    },
    env,
    homeDir() {
      return TEST_HOME
    },
    async readFile(filePath) {
      if (filePath === '/tmp/page.md') return '# From file'
      if (filePath in files) return files[filePath]
      const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as NodeJS.ErrnoException
      error.code = 'ENOENT'
      throw error
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
  it('initializes explicitly and returns the session as JSON', async () => {
    const output = createOutput()
    let calls = 0
    const wiki = createWikiStub({
      async initialize() {
        calls += 1
        return { schema: '# Schema', index: [], recentLog: [] }
      },
    })

    const exitCode = await runCliWithDeps(['init', '--json'], createDependencies(wiki, output))

    assert.equal(exitCode, 0)
    assert.equal(calls, 1)
    assert.deepEqual(JSON.parse(output.stdout.join('')), {
      schema: '# Schema', index: [], recentLog: [],
    })
  })

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

  it('uses HMD_API_ACCESS_TOKEN before hackmd-cli config token', async () => {
    const output = createOutput()
    const wikiConfigCalls: WikiConfigCall[] = []

    const exitCode = await runCliWithDeps(
      ['session', '--json'],
      createDependencies(
        createWikiStub(),
        output,
        { HMD_API_ACCESS_TOKEN: 'hackmd-cli-env-token' },
        {
          [HACKMD_CONFIG_PATH]: JSON.stringify({ accessToken: 'config-token' }),
        },
        wikiConfigCalls,
      ),
    )

    assert.equal(exitCode, 0)
    assert.equal(wikiConfigCalls[0].token, 'hackmd-cli-env-token')
  })

  it('uses ~/.hackmd/config.json accessToken when token env is missing', async () => {
    const output = createOutput()
    const wikiConfigCalls: WikiConfigCall[] = []

    const exitCode = await runCliWithDeps(
      ['session', '--json'],
      createDependencies(
        createWikiStub(),
        output,
        {},
        {
          [HACKMD_CONFIG_PATH]: JSON.stringify({ accessToken: 'config-token' }),
        },
        wikiConfigCalls,
      ),
    )

    assert.equal(exitCode, 0)
    assert.equal(wikiConfigCalls[0].token, 'config-token')
  })

  it('prefers --api-url over all endpoint env and config values', async () => {
    const output = createOutput()
    const wikiConfigCalls: WikiConfigCall[] = []

    const exitCode = await runCliWithDeps(
      ['session', '--api-url', 'https://cli.example/v1', '--json'],
      createDependencies(
        createWikiStub(),
        output,
        {
          HMD_API_ACCESS_TOKEN: 'tok',
          HMD_API_ENDPOINT_URL: 'https://hackmd-cli-env.example/v1',
        },
        {
          [HACKMD_CONFIG_PATH]: JSON.stringify({ hackmdAPIEndpointURL: 'https://config.example/v1' }),
        },
        wikiConfigCalls,
      ),
    )

    assert.equal(exitCode, 0)
    assert.equal(wikiConfigCalls[0].apiUrl, 'https://cli.example/v1')
  })

  it('uses HMD_API_ENDPOINT_URL before hackmd-cli config endpoint', async () => {
    const output = createOutput()
    const wikiConfigCalls: WikiConfigCall[] = []

    const exitCode = await runCliWithDeps(
      ['session', '--json'],
      createDependencies(
        createWikiStub(),
        output,
        {
          HMD_API_ACCESS_TOKEN: 'tok',
          HMD_API_ENDPOINT_URL: 'https://hackmd-cli-env.example/v1',
        },
        {
          [HACKMD_CONFIG_PATH]: JSON.stringify({ hackmdAPIEndpointURL: 'https://config.example/v1' }),
        },
        wikiConfigCalls,
      ),
    )

    assert.equal(exitCode, 0)
    assert.equal(wikiConfigCalls[0].apiUrl, 'https://hackmd-cli-env.example/v1')
  })

  it('uses ~/.hackmd/config.json hackmdAPIEndpointURL when endpoint env is missing', async () => {
    const output = createOutput()
    const wikiConfigCalls: WikiConfigCall[] = []

    const exitCode = await runCliWithDeps(
      ['session', '--json'],
      createDependencies(
        createWikiStub(),
        output,
        {},
        {
          [HACKMD_CONFIG_PATH]: JSON.stringify({
            accessToken: 'config-token',
            hackmdAPIEndpointURL: 'https://config.example/v1',
          }),
        },
        wikiConfigCalls,
      ),
    )

    assert.equal(exitCode, 0)
    assert.equal(wikiConfigCalls[0].apiUrl, 'https://config.example/v1')
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

  it('reads schema data as JSON', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async readSchema() {
        return '# Hackwiki Schema'
      },
    })

    const exitCode = await runCliWithDeps(
      ['schema', 'read', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    const json = JSON.parse(output.stdout.join(''))
    assert.equal(json.content, '# Hackwiki Schema')
  })

  it('updates schema data from a file path', async () => {
    const output = createOutput()
    const calls: string[] = []
    const wiki = createWikiStub({
      async updateSchema(content) {
        calls.push(content)
      },
    })

    const exitCode = await runCliWithDeps(
      ['schema', 'update', '--file', '/tmp/page.md', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(calls, ['# From file'])
    assert.deepEqual(JSON.parse(output.stdout.join('')), { success: true })
  })

  it('reads index entries as JSON', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async readIndex() {
        return [{ noteId: 'note-1', type: 'concept', title: 'RAG', summary: 'retrieval' }]
      },
    })

    const exitCode = await runCliWithDeps(
      ['index', 'read', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    const json = JSON.parse(output.stdout.join(''))
    assert.equal(json[0].title, 'RAG')
  })

  it('appends a log entry', async () => {
    const output = createOutput()
    const calls: Array<{ operation: string; title: string }> = []
    const wiki = createWikiStub({
      async appendLog(operation, title) {
        calls.push({ operation, title })
      },
    })

    const exitCode = await runCliWithDeps(
      ['log', 'append', 'ingest', 'Article A', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(calls, [{ operation: 'ingest', title: 'Article A' }])
    assert.equal(JSON.parse(output.stdout.join('')).success, true)
  })

  it('reads log data as JSON', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async readLog() {
        return '# Log\n\n## [2026-01-01] ingest | Article A'
      },
    })

    const exitCode = await runCliWithDeps(
      ['log', 'read', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    const json = JSON.parse(output.stdout.join(''))
    assert.match(json.content, /Article A/)
  })

  it('lists pages as JSON', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async listPages() {
        return [{ noteId: 'note-2', type: 'entity', title: 'OpenAI', summary: 'company' }]
      },
    })

    const exitCode = await runCliWithDeps(
      ['page', 'list', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    const json = JSON.parse(output.stdout.join(''))
    assert.equal(json[0].noteId, 'note-2')
  })

  it('passes fullText through to search', async () => {
    const output = createOutput()
    const calls: Array<{ query: string; fullText?: boolean }> = []
    const wiki = createWikiStub({
      async searchIndex(query, options) {
        calls.push({ query, fullText: options?.fullText })
        return [{ noteId: 'note-3', type: 'concept', title: 'BERT', summary: 'encoder' }]
      },
    })

    const exitCode = await runCliWithDeps(
      ['search', 'transformer', '--full-text', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(calls, [{ query: 'transformer', fullText: true }])
    const json = JSON.parse(output.stdout.join(''))
    assert.equal(json[0].title, 'BERT')
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

  it('adds index metadata to JSON when reading an indexed page', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async readPage() { return '# RAG' },
      async findIndexedPage() {
        return { noteId: 'note-1', type: 'concept', title: 'RAG', summary: 'retrieval' }
      },
    })

    const exitCode = await runCliWithDeps(
      ['page', 'read', 'note-1', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(JSON.parse(output.stdout.join('')), {
      noteId: 'note-1', content: '# RAG', type: 'concept', title: 'RAG', summary: 'retrieval',
    })
  })

  it('keeps the original JSON shape for an unindexed page', async () => {
    const output = createOutput()
    const exitCode = await runCliWithDeps(
      ['page', 'read', 'note-2', '--json'],
      createDependencies(createWikiStub(), output),
    )

    assert.equal(exitCode, 0)
    assert.deepEqual(JSON.parse(output.stdout.join('')), {
      noteId: 'note-2', content: '# Page',
    })
  })

  it('gives an init hint for an uninitialized session', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async startSession() {
        const error = new Error('Hackwiki is not initialized. Run `hackwiki init`.')
        error.name = 'WikiNotInitializedError'
        throw error
      },
    })

    const exitCode = await runCliWithDeps(['session', '--json'], createDependencies(wiki, output))

    assert.equal(exitCode, 1)
    assert.equal(output.stdout.join(''), '')
    assert.match(output.stderr.join(''), /hackwiki init/)
  })

  it('gives an init hint before an uninitialized write', async () => {
    const output = createOutput()
    const wiki = createWikiStub({
      async createPage() {
        const error = new Error('Hackwiki is not initialized. Run `hackwiki init`.')
        error.name = 'WikiNotInitializedError'
        throw error
      },
    })

    const exitCode = await runCliWithDeps(
      ['page', 'create', 'concept', 'RAG', '--summary', 'retrieval', '--content', '# RAG', '--json'],
      createDependencies(wiki, output),
    )

    assert.equal(exitCode, 1)
    assert.equal(output.stdout.join(''), '')
    assert.match(output.stderr.join(''), /hackwiki init/)
  })

  it('returns a usage error when all token sources are missing', async () => {
    const output = createOutput()
    const exitCode = await runCliWithDeps(
      ['session'],
      createDependencies(createWikiStub(), output, {}),
    )

    assert.equal(exitCode, 1)
    assert.match(output.stderr.join(''), /missing hackmd access token/i)
    assert.match(output.stderr.join(''), /HMD_API_ACCESS_TOKEN/)
    assert.match(output.stderr.join(''), /hackmd-cli login/)
  })

  it('returns a usage error when hackmd-cli config JSON is invalid', async () => {
    const output = createOutput()
    const exitCode = await runCliWithDeps(
      ['session'],
      createDependencies(
        createWikiStub(),
        output,
        {},
        { [HACKMD_CONFIG_PATH]: '{not json' },
      ),
    )

    assert.equal(exitCode, 1)
    assert.match(output.stderr.join(''), /invalid hackmd-cli config/i)
  })
})

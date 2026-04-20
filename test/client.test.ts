import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HackMDClient } from '../src/client.ts'

type FetchCall = {
  input: RequestInfo | URL
  init?: RequestInit
}

const originalFetch = globalThis.fetch

function installFetchMock(
  responder: (call: FetchCall) => Response | Promise<Response>,
): FetchCall[] {
  const calls: FetchCall[] = []

  globalThis.fetch = (async (input, init) => {
    const call = { input, init }
    calls.push(call)
    return responder(call)
  }) as typeof fetch

  return calls
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('HackMDClient', () => {
  it('lists notes with bearer auth against the default API URL', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify([{ id: 'note-1', title: 'Schema' }]),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = new HackMDClient('secret-token')
    const notes = await client.getNoteList()

    assert.deepEqual(notes, [{ id: 'note-1', title: 'Schema' }])
    assert.equal(calls.length, 1)
    assert.equal(String(calls[0].input), 'https://api.hackmd.io/v1/notes')
    assert.equal(calls[0].init?.method, 'GET')

    const headers = new Headers(calls[0].init?.headers)
    assert.equal(headers.get('Authorization'), 'Bearer secret-token')
    assert.equal(headers.get('Content-Type'), 'application/json')
  })

  it('creates notes with POST and a JSON body', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify({ id: 'note-2', content: '# Hello' }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = new HackMDClient('secret-token', 'https://example.com/v1/')
    const result = await client.createNote({
      title:           'Hello',
      content:         '# Hello',
      readPermission:  'owner',
      writePermission: 'owner',
    })

    assert.equal(result.id, 'note-2')
    assert.equal(String(calls[0].input), 'https://example.com/v1/notes')
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(
      calls[0].init?.body,
      JSON.stringify({
        title:           'Hello',
        content:         '# Hello',
        readPermission:  'owner',
        writePermission: 'owner',
      }),
    )
  })

  it('gets a single note via an encoded note id', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify({ id: 'note/id with spaces', content: '# Note' }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = new HackMDClient('secret-token')
    const note = await client.getNote('note/id with spaces')

    assert.equal(note.content, '# Note')
    assert.equal(
      String(calls[0].input),
      'https://api.hackmd.io/v1/notes/note%2Fid%20with%20spaces',
    )
    assert.equal(calls[0].init?.method, 'GET')
  })

  it('updates notes with PATCH and a JSON body', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify({ id: 'note-3', content: '# Updated' }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = new HackMDClient('secret-token')
    await client.updateNote('note-3', { content: '# Updated' })

    assert.equal(String(calls[0].input), 'https://api.hackmd.io/v1/notes/note-3')
    assert.equal(calls[0].init?.method, 'PATCH')
    assert.equal(calls[0].init?.body, JSON.stringify({ content: '# Updated' }))
  })

  it('throws a useful error for non-ok responses', async () => {
    installFetchMock(() => new Response(
      JSON.stringify({ error: 'bad token' }),
      {
        status:     401,
        statusText: 'Unauthorized',
        headers:    { 'Content-Type': 'application/json' },
      },
    ))

    const client = new HackMDClient('bad-token')

    await assert.rejects(
      () => client.getNoteList(),
      /401 Unauthorized.*bad token/i,
    )
  })

  it('throws when the token is missing', () => {
    assert.throws(
      () => new HackMDClient(''),
      /missing access token/i,
    )
  })
})

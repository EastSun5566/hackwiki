import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '../src/client.ts'

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

describe('createClient', () => {
  it('lists notes with bearer auth against the default API URL', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify([{ id: 'note-1', title: 'Schema' }]),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = createClient('secret-token')
    const notes = await client.getNoteList()

    assert.deepEqual(notes, [{ id: 'note-1', title: 'Schema' }])
    assert.equal(calls.length, 1)
    assert.equal(String(calls[0].input), 'https://api.hackmd.io/v1/notes')
    assert.equal(calls[0].init?.method, 'GET')

    const headers = new Headers(calls[0].init?.headers)
    assert.equal(headers.get('Authorization'), 'Bearer secret-token')
    assert.equal(headers.get('Content-Type'), 'application/json')
  })

  it('lists folders with bearer auth against the default API URL', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify([{
        id:             'folder-1',
        name:           '__HACKWIKI__',
        description:    null,
        icon:           null,
        color:          null,
        parentFolderId: null,
        createdAt:      1,
        updatedAt:      1,
      }]),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = createClient('secret-token')
    const folders = await client.getFolderList()

    assert.equal(folders.length, 1)
    assert.equal(folders[0].name, '__HACKWIKI__')
    assert.equal(String(calls[0].input), 'https://api.hackmd.io/v1/folders')
    assert.equal(calls[0].init?.method, 'GET')
  })

  it('creates notes with POST and a JSON body', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify({ id: 'note-2', content: '# Hello' }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = createClient('secret-token', 'https://example.com/v1/')
    const result = await client.createNote({
      title:           'Hello',
      content:         '# Hello',
      tags:            ['hackwiki'],
      parentFolderId:  'folder-1',
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
        tags:            ['hackwiki'],
        parentFolderId:  'folder-1',
        readPermission:  'owner',
        writePermission: 'owner',
      }),
    )
  })

  it('creates folders with POST and a JSON body', async () => {
    const calls = installFetchMock(() => new Response(
      JSON.stringify({
        id:             'folder-2',
        name:           'meta',
        description:    null,
        icon:           null,
        color:          null,
        parentFolderId: 'folder-1',
        createdAt:      2,
        updatedAt:      2,
      }),
      {
        status:  200,
        headers: { 'Content-Type': 'application/json' },
      },
    ))

    const client = createClient('secret-token')
    const folder = await client.createFolder({
      name: 'meta',
      parentFolderId: 'folder-1',
    })

    assert.equal(folder.id, 'folder-2')
    assert.equal(String(calls[0].input), 'https://api.hackmd.io/v1/folders')
    assert.equal(calls[0].init?.method, 'POST')
    assert.equal(
      calls[0].init?.body,
      JSON.stringify({
        name: 'meta',
        parentFolderId: 'folder-1',
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

    const client = createClient('secret-token')
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

    const client = createClient('secret-token')
    await client.updateNote('note-3', {
      content: '# Updated',
      parentFolderId: 'folder-2',
    })

    assert.equal(String(calls[0].input), 'https://api.hackmd.io/v1/notes/note-3')
    assert.equal(calls[0].init?.method, 'PATCH')
    assert.equal(
      calls[0].init?.body,
      JSON.stringify({
        content: '# Updated',
        parentFolderId: 'folder-2',
      }),
    )
  })

  it('routes every note and folder operation through an encoded team path', async () => {
    const calls = installFetchMock(() => new Response('[]', {
      status:  200,
      headers: { 'Content-Type': 'application/json' },
    }))
    const client = createClient('secret-token', undefined, 'docs/team name')

    await client.getNoteList()
    await client.createNote({ title: 'Page' })
    await client.getNote('note/id')
    await client.updateNote('note/id', { content: '# Page' })
    await client.getFolderList()
    await client.createFolder({ name: 'Folder' })

    assert.deepEqual(calls.map(call => ({
      url:    String(call.input),
      method: call.init?.method,
    })), [
      { url: 'https://api.hackmd.io/v1/teams/docs%2Fteam%20name/notes', method: 'GET' },
      { url: 'https://api.hackmd.io/v1/teams/docs%2Fteam%20name/notes', method: 'POST' },
      { url: 'https://api.hackmd.io/v1/teams/docs%2Fteam%20name/notes/note%2Fid', method: 'GET' },
      { url: 'https://api.hackmd.io/v1/teams/docs%2Fteam%20name/notes/note%2Fid', method: 'PATCH' },
      { url: 'https://api.hackmd.io/v1/teams/docs%2Fteam%20name/folders', method: 'GET' },
      { url: 'https://api.hackmd.io/v1/teams/docs%2Fteam%20name/folders', method: 'POST' },
    ])
    assert.ok(calls.every(call => !String(call.input).startsWith('https://api.hackmd.io/v1/notes')))
    assert.ok(calls.every(call => !String(call.input).startsWith('https://api.hackmd.io/v1/folders')))
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

    const client = createClient('bad-token')

    await assert.rejects(
      () => client.getNoteList(),
      /401 Unauthorized.*bad token/i,
    )
  })

  it('throws when the token is missing', () => {
    assert.throws(
      () => createClient(''),
      /missing access token/i,
    )
  })
})

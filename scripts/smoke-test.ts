import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '../src/client.ts'
import { createWiki } from '../src/index.ts'
import type { FolderSummary, NoteSummary } from '../src/types.ts'

const ROOT_FOLDER_NAME = '__HACKWIKI__'
const META_FOLDER_NAME = 'meta'
const RESERVED_TITLES = ['[hackwiki] schema', '[hackwiki] index', '[hackwiki] log'] as const
const PLACEHOLDER_TOKEN = 'your_hackmd_token_here'
const CONSISTENCY_RETRY_COUNT = 8
const CONSISTENCY_RETRY_DELAY_MS = 1500

type Snapshot = {
  rootFolder?: FolderSummary
  metaFolder?: FolderSummary
  reservedNotes: NoteSummary[]
  notes: NoteSummary[]
  folders: FolderSummary[]
}

type Summary = {
  reusedManagedLayout: boolean
  createdManagedLayout: boolean
  rootFolderId: string
  metaFolderId: string
  pageNoteId: string
  pageTitle: string
}

function loadEnvFile(rootDir: string) {
  const envPath = path.join(rootDir, '.env')
  if (!existsSync(envPath)) return

  const contents = readFileSync(envPath, 'utf8')
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separator = line.indexOf('=')
    if (separator < 0) continue

    const key = line.slice(0, separator).trim()
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function noteParentFolderId(note: NoteSummary): string | undefined {
  const paths = note.folderPaths ?? []
  const parent = paths[paths.length - 1]
  return typeof parent?.id === 'string' ? parent.id : undefined
}

function findManagedFolder(
  folders: FolderSummary[],
  name: string,
  parentFolderId: string | null,
): FolderSummary | undefined {
  const matches = folders.filter(folder =>
    folder.name === name &&
    (folder.parentFolderId ?? null) === parentFolderId,
  )

  if (matches.length > 1) {
    const location = parentFolderId === null ? 'root' : `folder ${parentFolderId}`
    throw new Error(`Smoke test found multiple folders named "${name}" under ${location}.`)
  }

  return matches[0]
}

function findReservedNotesInFolder(notes: NoteSummary[], folderId: string) {
  return notes.filter(note =>
    RESERVED_TITLES.includes(note.title as (typeof RESERVED_TITLES)[number]) &&
    noteParentFolderId(note) === folderId,
  )
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

async function snapshotState(token: string, apiUrl?: string): Promise<Snapshot> {
  const client = createClient(token, apiUrl)
  const [folders, notes] = await Promise.all([
    client.getFolderList(),
    client.getNoteList(),
  ])

  const rootFolder = findManagedFolder(folders, ROOT_FOLDER_NAME, null)
  const metaFolder = rootFolder
    ? findManagedFolder(folders, META_FOLDER_NAME, rootFolder.id)
    : undefined
  const reservedNotes = metaFolder
    ? findReservedNotesInFolder(notes, metaFolder.id)
    : []

  return {
    rootFolder,
    metaFolder,
    reservedNotes,
    notes,
    folders,
  }
}

async function waitForConsistentState(
  label: string,
  token: string,
  apiUrl?: string,
): Promise<Snapshot> {
  let latest = await snapshotState(token, apiUrl)

  for (let attempt = 1; attempt <= CONSISTENCY_RETRY_COUNT; attempt += 1) {
    const hasManagedFolders = Boolean(latest.rootFolder && latest.metaFolder)
    const hasReservedNotes = latest.reservedNotes.length === RESERVED_TITLES.length

    if (hasManagedFolders && hasReservedNotes) {
      return latest
    }

    console.log(
      `- waiting for HackMD consistency after ${label} (${attempt}/${CONSISTENCY_RETRY_COUNT})...`,
    )
    await new Promise(resolve => setTimeout(resolve, CONSISTENCY_RETRY_DELAY_MS))
    latest = await snapshotState(token, apiUrl)
  }

  return latest
}

function printSnapshot(label: string, snapshot: Snapshot) {
  console.log(`\n[${label}]`)
  console.log(`- root folder: ${snapshot.rootFolder?.id ?? 'missing'}`)
  console.log(`- meta folder: ${snapshot.metaFolder?.id ?? 'missing'}`)
  console.log(`- reserved notes in meta: ${snapshot.reservedNotes.length}`)
}

async function main() {
  const rootDir = process.cwd()
  loadEnvFile(rootDir)

  const token = process.env.HACKMD_TOKEN?.trim()
  const apiUrl = process.env.HACKMD_API_URL?.trim() || undefined
  const customPrefix = process.env.HACKWIKI_SMOKE_PREFIX?.trim()

  assert(token, 'Missing HACKMD_TOKEN. Fill in .env or provide it in your environment.')
  assert(token !== PLACEHOLDER_TOKEN, 'HACKMD_TOKEN still uses the placeholder value in .env.')

  const runId = new Date().toISOString().replace(/[:.]/gu, '-')
  const prefix = customPrefix || `hackwiki-smoke-${runId}`
  const pageTitle = `${prefix} concept page`
  const pageSummary = `Smoke test page created at ${new Date().toISOString()}`
  const pageContent = `# ${pageTitle}\n\nCreated by the real-world smoke test.`

  console.log('Running HackMD smoke test...')
  console.log(`- api: ${apiUrl ?? 'https://api.hackmd.io/v1'}`)
  console.log(`- prefix: ${prefix}`)

  const before = await snapshotState(token, apiUrl)
  printSnapshot('before', before)

  const wiki = createWiki({
    token,
    apiUrl,
    initialSchema: `# Smoke Schema\n\nRun prefix: ${prefix}`,
  })

  const firstSession = await wiki.startSession()
  assert(typeof firstSession.schema === 'string', 'First session did not return schema content.')

  const afterFirst = await waitForConsistentState('first startSession()', token, apiUrl)
  printSnapshot('after first startSession()', afterFirst)

  assert(afterFirst.rootFolder, `Expected ${ROOT_FOLDER_NAME} to exist after first startSession().`)
  assert(afterFirst.metaFolder, `Expected ${ROOT_FOLDER_NAME}/${META_FOLDER_NAME} to exist after first startSession().`)
  assert(afterFirst.reservedNotes.length === 3, 'Expected exactly 3 reserved notes inside managed meta folder.')

  const secondWiki = createWiki({ token, apiUrl })
  await secondWiki.startSession()
  const afterSecond = await waitForConsistentState('second startSession()', token, apiUrl)
  printSnapshot('after second startSession()', afterSecond)

  assert(afterSecond.rootFolder?.id === afterFirst.rootFolder.id, 'Root folder changed between runs; expected idempotent reuse.')
  assert(afterSecond.metaFolder?.id === afterFirst.metaFolder.id, 'Meta folder changed between runs; expected idempotent reuse.')
  assert(afterSecond.reservedNotes.length === afterFirst.reservedNotes.length, 'Reserved note count changed on second run; bootstrap is not idempotent.')

  const page = await wiki.createPage('concept', pageTitle, pageContent, pageSummary)
  const afterPage = await waitForConsistentState('createPage()', token, apiUrl)
  printSnapshot('after createPage()', afterPage)

  const createdNote = afterPage.notes.find(note => note.id === page.noteId)
  assert(createdNote, `Created page ${page.noteId} was not returned by HackMD note listing.`)
  assert(createdNote.title === `[concept] ${pageTitle}`, 'Created page title did not match the expected concept note title.')
  assert(noteParentFolderId(createdNote) === afterPage.rootFolder?.id, 'Created page did not land directly under the managed root folder.')

  const beforeHadManagedLayout = Boolean(before.rootFolder || before.metaFolder || before.reservedNotes.length)
  const summary: Summary = {
    reusedManagedLayout: beforeHadManagedLayout,
    createdManagedLayout: !beforeHadManagedLayout,
    rootFolderId: afterPage.rootFolder!.id,
    metaFolderId: afterPage.metaFolder!.id,
    pageNoteId: page.noteId,
    pageTitle,
  }

  console.log('\nSmoke test passed ✅')
  console.log(`- managed layout: ${summary.createdManagedLayout ? 'created during this run' : 'reused existing layout'}`)
  console.log(`- root folder id: ${summary.rootFolderId}`)
  console.log(`- meta folder id: ${summary.metaFolderId}`)
  console.log(`- created page: ${summary.pageTitle} (${summary.pageNoteId})`)
  console.log('\nNote: smoke-created artifacts are left in HackMD for manual inspection/cleanup.')
}

main().catch(error => {
  console.error('\nSmoke test failed ❌')
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
export type CliWikiNoteType = 'raw' | 'concept' | 'entity' | 'synthesis'

export interface CliWikiIndexEntry {
  noteId: string
  type: CliWikiNoteType
  title: string
  summary: string
}

export interface CliWikiSession {
  schema: string
  index: CliWikiIndexEntry[]
  recentLog: string[]
}

export interface CliLintReport {
  orphanPages: CliWikiIndexEntry[]
  undocumentedMentions: string[]
}

export interface CliCreatePageResult {
  noteId: string
  indexSize: number
}

export interface CliWiki {
  startSession(): Promise<CliWikiSession>
  createPage(type: CliWikiNoteType, title: string, content: string, summary: string): Promise<CliCreatePageResult>
  updatePage(noteId: string, content: string): Promise<void>
  readPage(noteId: string): Promise<string>
  searchIndex(query: string): Promise<CliWikiIndexEntry[]>
  lint(): Promise<CliLintReport>
}

export interface CliDeps {
  createWiki(config: { token: string; apiUrl?: string }): CliWiki
  env: Record<string, string | undefined>
  readFile(filePath: string): Promise<string>
  stdout(text: string): void
  stderr(text: string): void
}

class UserInputError extends Error {}

const HELP_TEXT = `hackwiki CLI

Usage:
  hackwiki session [--json] [--api-url <url>]
  hackwiki page create <type> <title> --summary <summary> (--content <content> | --file <path>) [--json] [--api-url <url>]
  hackwiki page update <noteId> (--content <content> | --file <path>) [--json] [--api-url <url>]
  hackwiki page read <noteId> [--json] [--api-url <url>]
  hackwiki search <query> [--json] [--api-url <url>]
  hackwiki lint [--json] [--api-url <url>]

Environment:
  HACKMD_TOKEN         required token used to authenticate with HackMD
  HACKMD_API_URL       optional override for the HackMD API base URL
`

function isWikiNoteType(value: string): value is CliWikiNoteType {
  return value === 'raw' || value === 'concept' || value === 'entity' || value === 'synthesis'
}

function extractOption(tokens: string[], name: string): string | undefined {
  const index = tokens.indexOf(name)
  if (index < 0) return undefined

  const value = tokens[index + 1]
  if (value === undefined) {
    throw new UserInputError(`Missing value for ${name}.`)
  }

  tokens.splice(index, 2)
  return value
}

function parseGlobalOptions(args: string[]) {
  const rest: string[] = []
  let json = false
  let apiUrl: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token === '--json') {
      json = true
      continue
    }

    if (token === '--api-url') {
      const value = args[index + 1]
      if (value === undefined) {
        throw new UserInputError('Missing value for --api-url.')
      }
      apiUrl = value
      index += 1
      continue
    }

    rest.push(token)
  }

  return { json, apiUrl, rest }
}

function renderIndexEntry(entry: CliWikiIndexEntry): string {
  return `- [${entry.type}] ${entry.title} (${entry.noteId}) — ${entry.summary}`
}

function writeJson(deps: CliDeps, value: unknown) {
  deps.stdout(`${JSON.stringify(value, null, 2)}\n`)
}

function writeText(deps: CliDeps, text: string) {
  deps.stdout(`${text}\n`)
}

async function loadContent(tokens: string[], deps: CliDeps): Promise<string> {
  const inlineContent = extractOption(tokens, '--content')
  const filePath = extractOption(tokens, '--file')

  if (inlineContent && filePath) {
    throw new UserInputError('Use either --content or --file, not both.')
  }

  if (filePath) {
    return deps.readFile(filePath)
  }

  if (inlineContent !== undefined) {
    return inlineContent
  }

  throw new UserInputError('Missing content. Provide --content or --file.')
}

function createWikiFromEnv(deps: CliDeps, apiUrl?: string): CliWiki {
  const token = deps.env.HACKMD_TOKEN?.trim()
  if (!token) {
    throw new UserInputError('Missing HACKMD_TOKEN. Set it in the environment before running the CLI.')
  }

  const resolvedApiUrl = apiUrl ?? (deps.env.HACKMD_API_URL?.trim() || undefined)
  return deps.createWiki({ token, apiUrl: resolvedApiUrl })
}

export async function runCliWithDeps(args: string[], deps: CliDeps): Promise<number> {
  try {
    const { json, apiUrl, rest } = parseGlobalOptions(args)

    if (rest.length === 0 || rest[0] === '--help' || rest[0] === '-h' || rest[0] === 'help') {
      writeText(deps, HELP_TEXT.trimEnd())
      return 0
    }

    const wiki = createWikiFromEnv(deps, apiUrl)
    const [command, ...commandArgs] = rest

    if (command === 'session') {
      if (commandArgs.length > 0) {
        throw new UserInputError('The session command does not take positional arguments.')
      }

      const session = await wiki.startSession()
      if (json) {
        writeJson(deps, session)
      } else {
        writeText(
          deps,
          [
            '# Session',
            '',
            '## Schema',
            session.schema || '(empty)',
            '',
            `Index entries: ${session.index.length}`,
            `Recent log entries: ${session.recentLog.length}`,
          ].join('\n'),
        )
      }
      return 0
    }

    if (command === 'search') {
      if (commandArgs.length === 0) {
        throw new UserInputError('The search command requires a query.')
      }

      const query = commandArgs.join(' ')
      const results = await wiki.searchIndex(query)
      if (json) {
        writeJson(deps, results)
      } else if (results.length === 0) {
        writeText(deps, 'No matches found.')
      } else {
        writeText(deps, results.map(renderIndexEntry).join('\n'))
      }
      return 0
    }

    if (command === 'lint') {
      if (commandArgs.length > 0) {
        throw new UserInputError('The lint command does not take positional arguments.')
      }

      const report = await wiki.lint()
      if (json) {
        writeJson(deps, report)
      } else {
        const orphanLines = report.orphanPages.length > 0
          ? report.orphanPages.map(renderIndexEntry)
          : ['(none)']
        const mentionLines = report.undocumentedMentions.length > 0
          ? report.undocumentedMentions.map(item => `- ${item}`)
          : ['(none)']
        writeText(
          deps,
          [
            '# Lint Report',
            '',
            '## Orphan Pages',
            ...orphanLines,
            '',
            '## Undocumented Mentions',
            ...mentionLines,
          ].join('\n'),
        )
      }
      return 0
    }

    if (command === 'page') {
      const [subcommand, ...pageArgs] = commandArgs
      if (!subcommand) {
        throw new UserInputError('The page command requires a subcommand (create, update, or read).')
      }

      if (subcommand === 'create') {
        const tokens = [...pageArgs]
        const type = tokens.shift()
        const title = tokens.shift()
        if (!type || !title) {
          throw new UserInputError('Usage: hackwiki page create <type> <title> --summary <summary> (--content <content> | --file <path>)')
        }
        if (!isWikiNoteType(type)) {
          throw new UserInputError(`Invalid page type: ${type}. Expected raw, concept, entity, or synthesis.`)
        }

        const summary = extractOption(tokens, '--summary')
        if (!summary) {
          throw new UserInputError('Missing --summary for page create.')
        }
        const content = await loadContent(tokens, deps)
        if (tokens.length > 0) {
          throw new UserInputError(`Unexpected arguments for page create: ${tokens.join(' ')}`)
        }

        const result = await wiki.createPage(type, title, content, summary)
        if (json) {
          writeJson(deps, {
            type,
            title,
            summary,
            ...result,
          })
        } else {
          writeText(deps, `Created ${type} page "${title}" (${result.noteId}); index size is now ${result.indexSize}.`)
        }
        return 0
      }

      if (subcommand === 'update') {
        const tokens = [...pageArgs]
        const noteId = tokens.shift()
        if (!noteId) {
          throw new UserInputError('Usage: hackwiki page update <noteId> (--content <content> | --file <path>)')
        }
        const content = await loadContent(tokens, deps)
        if (tokens.length > 0) {
          throw new UserInputError(`Unexpected arguments for page update: ${tokens.join(' ')}`)
        }

        await wiki.updatePage(noteId, content)
        if (json) {
          writeJson(deps, { success: true, noteId })
        } else {
          writeText(deps, `Updated page ${noteId}.`)
        }
        return 0
      }

      if (subcommand === 'read') {
        if (pageArgs.length !== 1) {
          throw new UserInputError('Usage: hackwiki page read <noteId>')
        }
        const [noteId] = pageArgs
        const content = await wiki.readPage(noteId)
        if (json) {
          writeJson(deps, { noteId, content })
        } else {
          writeText(deps, content)
        }
        return 0
      }

      throw new UserInputError(`Unknown page subcommand: ${subcommand}.`)
    }

    throw new UserInputError(`Unknown command: ${command}.`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof UserInputError) {
      deps.stderr(`Error: ${message}\n`)
      deps.stderr('Run `hackwiki --help` for usage details.\n')
      return 1
    }

    deps.stderr(`Error: ${message}\n`)
    return 2
  }
}

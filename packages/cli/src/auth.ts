const HACKMD_CONFIG_PATH = '.hackmd/config.json'

export interface AuthDeps {
  env: Record<string, string | undefined>
  homeDir(): string
  readFile(filePath: string): Promise<string>
}

export interface ResolvedAuthConfig {
  token: string
  apiUrl?: string
  teamPath?: string
}

interface HackMDCliConfig {
  accessToken?: unknown
  hackmdAPIEndpointURL?: unknown
}

export class AuthConfigError extends Error {}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}

function resolveHackMDConfigPath(homeDir: string): string {
  return `${homeDir.replace(/\/+$/, '')}/${HACKMD_CONFIG_PATH}`
}

async function readHackMDCliConfig(deps: AuthDeps): Promise<HackMDCliConfig> {
  const configPath = resolveHackMDConfigPath(deps.homeDir())

  try {
    const raw = await deps.readFile(configPath)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new AuthConfigError(`Invalid hackmd-cli config at ${configPath}: expected a JSON object.`)
    }
    return parsed as HackMDCliConfig
  } catch (error) {
    if (isFileNotFound(error)) {
      return {}
    }
    if (error instanceof AuthConfigError) {
      throw error
    }
    if (error instanceof SyntaxError) {
      throw new AuthConfigError(`Invalid hackmd-cli config at ${configPath}: ${error.message}`)
    }
    throw error
  }
}

function configString(config: HackMDCliConfig, key: keyof HackMDCliConfig): string | undefined {
  const value = config[key]
  return typeof value === 'string' ? nonEmpty(value) : undefined
}

export async function resolveAuthConfig(
  deps: AuthDeps,
  cliApiUrl?: string,
  cliTeamPath?: string,
): Promise<ResolvedAuthConfig> {
  const config = await readHackMDCliConfig(deps)
  const token = nonEmpty(deps.env.HMD_API_ACCESS_TOKEN)
    ?? configString(config, 'accessToken')

  if (!token) {
    throw new AuthConfigError(
      'Missing HackMD access token. Set HMD_API_ACCESS_TOKEN or run `hackmd-cli login` to create ~/.hackmd/config.json.',
    )
  }

  const apiUrl = nonEmpty(cliApiUrl)
    ?? nonEmpty(deps.env.HMD_API_ENDPOINT_URL)
    ?? configString(config, 'hackmdAPIEndpointURL')

  const teamPath = nonEmpty(cliTeamPath)
    ?? nonEmpty(deps.env.HACKWIKI_TEAM_PATH)

  return { token, apiUrl, teamPath }
}

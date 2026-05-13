import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { createWiki } from '@hackwiki/sdk'
import { runCliWithDeps } from './runner.ts'

export async function runCli(args: string[]) {
  return runCliWithDeps(args, {
    createWiki(config) {
      return createWiki(config)
    },
    env: process.env,
    readFile(filePath) {
      return readFile(filePath, 'utf8')
    },
    stdout(text) {
      process.stdout.write(text)
    },
    stderr(text) {
      process.stderr.write(text)
    },
  })
}

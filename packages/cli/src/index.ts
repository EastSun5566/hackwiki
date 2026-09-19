import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import process from 'node:process'
import { createWiki } from '@hackwiki/sdk'
import { runCliWithDeps } from './runner.ts'

export async function runCli(args: string[]) {
  return runCliWithDeps(args, {
    createWiki(config) {
      return createWiki(config)
    },
    env: process.env,
    homeDir() {
      return homedir()
    },
    readFile(filePath) {
      return readFile(filePath, 'utf8')
    },
    async readStdin() {
      process.stdin.setEncoding('utf8')
      let content = ''
      for await (const chunk of process.stdin) content += chunk
      return content
    },
    stdout(text) {
      process.stdout.write(text)
    },
    stderr(text) {
      process.stderr.write(text)
    },
  })
}

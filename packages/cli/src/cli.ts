#!/usr/bin/env node
import process from 'node:process'
import { runCli } from './index.ts'

const exitCode = await runCli(process.argv.slice(2))
if (exitCode !== 0) {
  process.exitCode = exitCode
}

#!/usr/bin/env node
/**
 * The source a build was made from: the last commit that changed the app, and a hash of the
 * tracked app changes on top of it. Specs and docs are left out, so editing a spec needs no rebuild.
 *
 * `build:e2e` writes it next to the standalone server; `preflight.check.ts` compares it with the
 * tree. A stale build passes every other harness check, and then the suite tests code that is no
 * longer there. New untracked files are not in the hash.
 *
 *   node e2e/setup/build-stamp.mjs           write .next/standalone/e2e-build.json
 *   node e2e/setup/build-stamp.mjs --print   print the stamp of the tree, write nothing
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const STAMP_FILE = '.next/standalone/e2e-build.json'

// Paths that do not go into the build.
const NOT_BUILT = [
  ':(exclude)e2e',
  ':(exclude)docs',
  ':(exclude)*.md',
  ':(exclude)playwright.config.ts',
]

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const stamp = {
  commit: git('log', '-1', '--format=%H', '--', '.', ...NOT_BUILT).trim(),
  changes: createHash('sha256')
    .update(git('diff', 'HEAD', '--binary', '--', '.', ...NOT_BUILT))
    .digest('hex'),
}

if (process.argv.includes('--print')) {
  process.stdout.write(JSON.stringify(stamp))
} else {
  writeFileSync(STAMP_FILE, JSON.stringify(stamp, null, 2) + '\n')
}

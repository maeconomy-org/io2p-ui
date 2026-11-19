#!/usr/bin/env node
/**
 * The source a build was made from, by content: the app files on disk, tracked or new, and the
 * installed SDK. Specs and docs are left out, so editing a spec needs no rebuild, and a commit of
 * the tree that was built keeps the same stamp.
 *
 * `build:e2e` writes it next to the standalone server; `preflight.check.ts` compares it with the
 * tree. A stale build passes every other harness check, and then the suite tests code that is no
 * longer there.
 *
 *   node e2e/setup/build-stamp.mjs           write .next/standalone/e2e-build.json
 *   node e2e/setup/build-stamp.mjs --print   print the stamp of the tree, write nothing
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

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

const sha = (...parts) => {
  const hash = createHash('sha256')
  for (const part of parts) hash.update(part)
  return hash.digest('hex')
}

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort()
}

const hashFiles = (files) =>
  sha(...files.flatMap((file) => [file, '\0', readFileSync(file), '\0']))

// What is on disk, tracked or new, so a commit of the built tree keeps the stamp.
const appFiles = git(
  'ls-files',
  '--cached',
  '--others',
  '--exclude-standard',
  '--',
  '.',
  ...NOT_BUILT
)
  .split('\n')
  .filter((file) => file && existsSync(file))
  .sort()

// `/sdk-sync` copies the client's dist into node_modules and changes no tracked file.
const sdkDist = path.join(realpathSync('node_modules/io2p-client'), 'dist')

const stamp = {
  source: sha(
    execFileSync('git', ['hash-object', '--stdin-paths'], {
      input: appFiles.join('\n'),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }),
    appFiles.join('\n')
  ),
  sdk: hashFiles(filesUnder(sdkDist)),
}

if (process.argv.includes('--print')) {
  process.stdout.write(JSON.stringify(stamp))
} else {
  writeFileSync(STAMP_FILE, JSON.stringify(stamp, null, 2) + '\n')
}

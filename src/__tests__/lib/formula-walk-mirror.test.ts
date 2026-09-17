// `formula-expression.ts` carries a block copied from io2p-core, not written here. Nothing else
// can notice when that copy goes stale: the exports keep their names, the types still line up, and
// every test still passes while the preview quietly answers a question the node answers differently.
//
// It has already happened twice. The walk went from `scaleFree` (has a scalar touched a property?)
// to `keepsArgDimension` (does the result still carry the args' dimension?), and the SECOND move
// changed the meaning while keeping the shape — a rename would not have caught it.
//
// Pinned to a COMMIT, never to a branch: core's `origin/dev` currently holds the pre-change walk,
// so pinning there would compare against the wrong content and pass.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

/** The commit the mirrored block was copied from. Bump it, and the block, together. */
const PINNED_SHA = 'c721daa'
const CORE_FILE = 'src/shared/calc.eval.ts'

/**
 * Where io2p-core is checked out. Sibling layout by default; `IO2P_CORE_PATH` overrides it.
 * ABSENT IN CI, where only this repo is checked out — the test skips there and says so rather
 * than failing on a machine that could never pass it.
 */
const CORE_REPO =
  process.env.IO2P_CORE_PATH ??
  path.resolve(process.cwd(), '../../io2p/io2p-core')

const START = '// ── Unit-inheritance safety (the scalar-aware taint walk)'
const END = '// Why a calc produced no usable number'

/** Ours ends where the next docblock begins; core's ends at the comment above. */
function extract(source: string, end: string): string {
  const from = source.indexOf(START)
  const to = source.indexOf(end, from)
  if (from === -1 || to === -1) return ''
  return source.slice(from, to)
}

/**
 * Compare CODE, not punctuation. Core is semicolon-and-trailing-comma TypeScript; this repo's
 * prettier config is neither, so the same lines differ on characters that carry no meaning.
 */
function normalize(block: string): string {
  return block
    .split('\n')
    .map((line) => line.replace(/[;,]\s*$/, '').trimEnd())
    .filter((line) => line.trim() !== '')
    .join('\n')
}

describe('the taint walk mirrored from io2p-core', () => {
  const available = existsSync(path.join(CORE_REPO, '.git'))

  it.skipIf(!available)(
    `matches ${CORE_FILE} at ${PINNED_SHA}, character for character`,
    () => {
      const theirs = execFileSync(
        'git',
        ['show', `${PINNED_SHA}:${CORE_FILE}`],
        { cwd: CORE_REPO, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }
      )
      const ours = readFileSync(
        path.resolve(process.cwd(), 'src/lib/formula-expression.ts'),
        'utf8'
      )

      const theirBlock = normalize(extract(theirs, END))
      const ourBlock = normalize(extract(ours, '/**'))

      expect(theirBlock, `core has no block starting "${START}"`).not.toBe('')
      expect(ourBlock, `our mirror has no block starting "${START}"`).not.toBe(
        ''
      )
      // On failure: re-copy the block from core and update PINNED_SHA in the same commit.
      expect(ourBlock).toBe(theirBlock)
    }
  )

  it('refuses to pass quietly when IO2P_CORE_PATH points nowhere', () => {
    // The skip above is for the machine that never had the repo — CI. Someone who SET the variable
    // meant to run the check, so a wrong path must fail rather than skip into a green run.
    expect(process.env.IO2P_CORE_PATH === undefined || available).toBe(true)
  })
})

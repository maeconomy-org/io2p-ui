#!/usr/bin/env node
// Generates the upload fixture files used by the e2e specs in
// e2e/05-upload-center/. Idempotent: a file is only rewritten when it's
// missing or its size doesn't match the spec, so re-running this is cheap.
//
// Binaries are intentionally not committed — they're regenerated on each
// `pnpm test:e2e` via the `pretest:e2e` npm script.

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { generateSheets } from './sheets/generate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, 'uploads')

// Deterministic pseudo-random bytes. Seed-stable across runs so any
// fixture-aware assertion (e.g. checksum) stays valid. The PRNG is
// `mulberry32` — fast, good enough for non-cryptographic test data.
function prng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
}

function randomBytes(seed, size) {
  const buf = Buffer.allocUnsafe(size)
  const rnd = prng(seed)
  for (let i = 0; i < size; i += 4) {
    const v = rnd()
    buf[i] = v & 0xff
    if (i + 1 < size) buf[i + 1] = (v >>> 8) & 0xff
    if (i + 2 < size) buf[i + 2] = (v >>> 16) & 0xff
    if (i + 3 < size) buf[i + 3] = (v >>> 24) & 0xff
  }
  return buf
}

const KB = 1024
const MB = 1024 * KB

// A real 8x8 PNG, not random bytes: a cover image has to DECODE. The browser renders it, the node
// derives a thumbnail from it, and `cover-thumb` only appears for something the pipeline accepted.
// Solid teal so a human reading a failure screenshot sees a deliberate square rather than noise.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR42mMQ2bEUK2IYWhIA55VcQX2PZw4AAAAASUVORK5CYII='

// [filename, seed, byteSize, content?]. If `content` is set, use it verbatim; a `Buffer` is written
// as-is, a string as UTF-8.
const fixtures = [
  ['tiny-1kb.txt', 1, 1 * KB, 'tiny fixture\n'.repeat(64).slice(0, 1 * KB)],
  ['small-100kb.pdf', 2, 100 * KB],
  ['medium-2mb.pdf', 3, 2 * MB],
  ['large-9mb.bin', 4, 9 * MB],
  ['big-25mb.bin', 5, 25 * MB],
  ['weird-name (1) — café.pdf', 6, 50 * KB],
  ['no-extension', 7, 50 * KB],
  ['EMPTY.txt', 8, 0, ''],
  ['cover-8px.png', 9, 0, Buffer.from(TINY_PNG_BASE64, 'base64')],
]

async function ensureFile(name, seed, size, content) {
  const path = resolve(outDir, name)
  // For content-defined fixtures, the source-of-truth size is the byte length
  // of the encoded content, not the nominal `size` (which acts as a label).
  const data = Buffer.isBuffer(content)
    ? content
    : typeof content === 'string'
      ? Buffer.from(content, 'utf8')
      : null
  const expectedSize = data ? data.length : size

  try {
    const s = await stat(path)
    if (s.size === expectedSize) return { name, status: 'ok' }
  } catch {
    // missing — fall through to write
  }

  const buf = data ?? randomBytes(seed, size)
  await writeFile(path, buf)
  return { name, status: 'written', bytes: buf.length }
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const results = [
    ...(await Promise.all(
      fixtures.map(([name, seed, size, content]) =>
        ensureFile(name, seed, size, content)
      )
    )),
    ...(await generateSheets()),
  ]
  const written = results.filter((r) => r.status === 'written')
  if (written.length === 0) {
    process.stdout.write('e2e fixtures up to date\n')
  } else {
    for (const r of written) {
      process.stdout.write(`e2e fixture: wrote ${r.name} (${r.bytes} bytes)\n`)
    }
  }
}

main().catch((err) => {
  process.stderr.write(`fixture generation failed: ${err?.stack ?? err}\n`)
  process.exit(1)
})

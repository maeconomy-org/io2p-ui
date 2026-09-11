import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { test, expect } from '@playwright/test'

// Read the locale files at runtime rather than `import ... from .json`.
// Node 22+ requires `with { type: 'json' }` on JSON imports; the repo is
// ESM (package.json "type": "module") so __dirname is also unavailable.
// Resolve relative to import.meta.url instead.
const here = dirname(fileURLToPath(import.meta.url))
const messagesDir = resolve(here, '../../src/messages')
const enMessages = JSON.parse(
  readFileSync(resolve(messagesDir, 'en.json'), 'utf8')
) as Record<string, unknown>
const nlMessages = JSON.parse(
  readFileSync(resolve(messagesDir, 'nl.json'), 'utf8')
) as Record<string, unknown>

/**
 * §32 — Translation key parity.
 *
 * A full Dutch-locale render test would need locale switching scaffolding
 * the app doesn't expose for E2E yet. What we CAN guarantee cheaply is that
 * every key added by this work resolves in both locales — which is the
 * actual failure mode users hit (a `t('upload.tooManyFiles')` falling
 * through to the raw key string in production).
 */

// Every entry must be RENDERED somewhere in src/ — a key listed here but bound
// by nothing passes parity while the prune rule reads it as dead and removes it.
const requiredKeys: Array<[section: string, key: string]> = [
  ['objects.attachments', 'tooManyFiles'],
  ['objects.attachments', 'dragDrop'],
  ['objects.attachments', 'externalUrl'],
  ['objects.attachments', 'labelOptional'],
  ['objects.attachments', 'maxSize'],
  ['objects.files', 'noFiles'],
]

function read(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, k) => acc?.[k], obj)
}

test.describe('05 - Upload Center — i18n key parity', () => {
  for (const [section, key] of requiredKeys) {
    test(`TC32x: ${section}.${key} resolves in en and nl`, () => {
      const fullPath = `${section}.${key}`
      const en = read(enMessages, fullPath)
      const nl = read(nlMessages, fullPath)
      expect(en, `missing en.${fullPath}`).toBeTruthy()
      expect(nl, `missing nl.${fullPath}`).toBeTruthy()
      expect(typeof en).toBe('string')
      expect(typeof nl).toBe('string')
    })
  }
})

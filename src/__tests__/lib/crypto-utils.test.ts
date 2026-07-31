import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

let encrypt: (v: string) => string
let decrypt: (v: string) => string

beforeAll(async () => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  const mod = await import('@/lib/crypto-utils')
  encrypt = mod.encrypt
  decrypt = mod.decrypt
})

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig'

describe('crypto-utils', () => {
  it('round-trips a token', () => {
    expect(decrypt(encrypt(JWT))).toBe(JWT)
  })

  it('passes a legacy PLAINTEXT jwt through untouched', () => {
    // A JWT is base64url with two dots, so it can never be an encrypted payload.
    expect(decrypt(JWT)).toBe(JWT)
  })

  it('THROWS when something encrypted-shaped will not decrypt', () => {
    // The case that used to return the ciphertext as if it were the token: `ENCRYPTION_KEY` is
    // auto-generated when unset, so a restart without it makes every stored token undecryptable.
    // Handing the ciphertext to the API surfaces as a 401 — "session expired" — instead of the
    // truth, which is that this node cannot read what it wrote.
    const corrupted = Buffer.concat([
      Buffer.alloc(16, 1), // iv
      Buffer.alloc(16, 2), // auth tag that matches nothing
      Buffer.from('not-really-ciphertext'),
    ]).toString('base64')

    expect(() => decrypt(corrupted)).toThrow(/ENCRYPTION_KEY/)
  })

  it('passes short non-base64 values through rather than throwing', () => {
    // Too small to carry an iv and a tag, so it cannot be a failed decryption.
    expect(decrypt('short')).toBe('short')
  })
})

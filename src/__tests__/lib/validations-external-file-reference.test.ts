import { describe, it, expect } from 'vitest'
import { isAllowedExternalFileReference } from '@/lib/validations/external-file-reference'

describe('isAllowedExternalFileReference', () => {
  it('accepts a plain https URL on a public host', () => {
    expect(
      isAllowedExternalFileReference('https://cdn.example.com/a/b.jpg')
    ).toBe(true)
  })

  it('accepts https URL with port and query string', () => {
    expect(
      isAllowedExternalFileReference(
        'https://images.example.com:8443/photo.png?w=600'
      )
    ).toBe(true)
  })

  it('rejects null, undefined, empty, and whitespace', () => {
    expect(isAllowedExternalFileReference(null)).toBe(false)
    expect(isAllowedExternalFileReference(undefined)).toBe(false)
    expect(isAllowedExternalFileReference('')).toBe(false)
    expect(isAllowedExternalFileReference('   ')).toBe(false)
  })

  it('rejects unparseable strings', () => {
    expect(isAllowedExternalFileReference('not a url')).toBe(false)
    expect(isAllowedExternalFileReference('://broken')).toBe(false)
  })

  it('rejects non-https schemes', () => {
    expect(isAllowedExternalFileReference('http://example.com/x')).toBe(false)
    expect(
      isAllowedExternalFileReference('javascript:alert(document.cookie)')
    ).toBe(false)
    expect(
      isAllowedExternalFileReference('data:text/html,<script>alert(1)</script>')
    ).toBe(false)
    expect(isAllowedExternalFileReference('file:///etc/passwd')).toBe(false)
    expect(isAllowedExternalFileReference('blob:https://example.com/x')).toBe(
      false
    )
    expect(isAllowedExternalFileReference('ftp://example.com/x')).toBe(false)
  })

  it('rejects URLs that carry userinfo', () => {
    expect(isAllowedExternalFileReference('https://user@example.com/x')).toBe(
      false
    )
    expect(
      isAllowedExternalFileReference('https://user:pass@example.com/x')
    ).toBe(false)
  })

  it('rejects localhost and loopback names', () => {
    expect(isAllowedExternalFileReference('https://localhost/x')).toBe(false)
    expect(isAllowedExternalFileReference('https://LOCALHOST/x')).toBe(false)
    expect(isAllowedExternalFileReference('https://ip6-localhost/x')).toBe(
      false
    )
  })

  it('rejects mDNS / internal suffixes', () => {
    expect(isAllowedExternalFileReference('https://printer.local/x')).toBe(
      false
    )
    expect(isAllowedExternalFileReference('https://router.localdomain/x')).toBe(
      false
    )
    expect(isAllowedExternalFileReference('https://api.internal/x')).toBe(false)
  })

  it('rejects IPv4 literals (private and public alike)', () => {
    expect(isAllowedExternalFileReference('https://127.0.0.1/x')).toBe(false)
    expect(isAllowedExternalFileReference('https://10.0.0.1/x')).toBe(false)
    expect(isAllowedExternalFileReference('https://192.168.1.1/x')).toBe(false)
    expect(isAllowedExternalFileReference('https://8.8.8.8/x')).toBe(false)
  })

  it('rejects IPv6 literals', () => {
    expect(isAllowedExternalFileReference('https://[::1]/x')).toBe(false)
    expect(isAllowedExternalFileReference('https://[2001:db8::1]/x')).toBe(
      false
    )
  })
})

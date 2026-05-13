import { describe, it, expect } from 'vitest'
import { beforeSend, redactPresignedUrlString } from '@/lib/sentry-config'

const SIG = 'a1b2c3d4e5f60718293a4b5c6d7e8f9011223344556677889900aabbccddeeff'
const CRED = 'AKIAEXAMPLE/20260512/eu-west-1/s3/aws4_request'

describe('redactPresignedUrlString', () => {
  it('redacts every documented X-Amz-* query parameter', () => {
    const url =
      `https://bucket.s3.eu-west-1.amazonaws.com/key.bin` +
      `?X-Amz-Algorithm=AWS4-HMAC-SHA256` +
      `&X-Amz-Credential=${encodeURIComponent(CRED)}` +
      `&X-Amz-Date=20260512T120000Z` +
      `&X-Amz-Expires=300` +
      `&X-Amz-SignedHeaders=host` +
      `&X-Amz-Security-Token=tokenvalue` +
      `&X-Amz-Signature=${SIG}`
    const out = redactPresignedUrlString(url)
    expect(out).not.toContain(SIG)
    expect(out).not.toContain('AKIAEXAMPLE')
    expect(out).not.toContain('tokenvalue')
    expect(out).toContain('X-Amz-Signature=REDACTED')
    expect(out).toContain('X-Amz-Credential=REDACTED')
    expect(out).toContain('X-Amz-Security-Token=REDACTED')
    // Bucket host + path should be preserved for debugging.
    expect(out).toContain('bucket.s3.eu-west-1.amazonaws.com/key.bin')
  })

  it('is case-insensitive on the parameter name', () => {
    const url = `https://x.example/path?x-amz-signature=${SIG}`
    const out = redactPresignedUrlString(url)
    expect(out).not.toContain(SIG)
    expect(out.toLowerCase()).toContain('x-amz-signature=redacted')
  })

  it('redacts a SigV4 Authorization header value embedded in a string', () => {
    const msg = `Request failed: AWS4-HMAC-SHA256 Credential=${CRED}, SignedHeaders=host;x-amz-date, Signature=${SIG} returned 403`
    const out = redactPresignedUrlString(msg)
    expect(out).not.toContain(SIG)
    expect(out).not.toContain('AKIAEXAMPLE')
    expect(out).toContain('AWS4-HMAC-SHA256 REDACTED')
  })

  it('passes through strings that have nothing to redact', () => {
    expect(redactPresignedUrlString('https://example.com/x?foo=bar')).toBe(
      'https://example.com/x?foo=bar'
    )
    expect(redactPresignedUrlString('')).toBe('')
  })
})

describe('beforeSend', () => {
  it('redacts presigned URLs in request, breadcrumbs, and exception values', () => {
    const url = `https://bucket.s3.amazonaws.com/k?X-Amz-Signature=${SIG}`
    // SentryEvent is a structural type — cast through unknown for the test stub.
    const event = {
      request: { url, headers: {} },
      breadcrumbs: [
        { category: 'fetch', data: { url, method: 'PUT' } },
        { category: 'navigation', data: { from: url, to: url } },
        { category: 'console' },
      ],
      exception: { values: [{ type: 'Error', value: `PUT ${url} failed` }] },
      message: `boom ${url}`,
    } as unknown as Parameters<typeof beforeSend>[0]

    const out = beforeSend(event)
    expect(out).not.toBeNull()
    expect(out!.request!.url).not.toContain(SIG)
    expect(out!.breadcrumbs![0]!.data!.url).not.toContain(SIG)
    expect(out!.breadcrumbs![1]!.data!.from).not.toContain(SIG)
    expect(out!.breadcrumbs![1]!.data!.to).not.toContain(SIG)
    expect(out!.exception!.values![0]!.value).not.toContain(SIG)
    expect(out!.message).not.toContain(SIG)
  })

  it('redacts presigned URLs nested in Error.cause chains and extra', () => {
    const url = `https://bucket.s3.amazonaws.com/k?X-Amz-Signature=${SIG}`
    const event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'wrapper',
            mechanism: {
              data: {
                cause: {
                  message: `inner failed at ${url}`,
                  cause: { message: `root cause ${url}` },
                },
              },
            },
          },
        ],
      },
      extra: {
        responseBody: `S3 said: ${url}`,
        nested: { url, list: [url, `prefix ${url} suffix`] },
      },
    } as unknown as Parameters<typeof beforeSend>[0]

    const out = beforeSend(event)
    expect(out).not.toBeNull()
    const serialized = JSON.stringify(out)
    expect(serialized).not.toContain(SIG)
    // The non-signature parts of the URL are still useful for debugging.
    expect(serialized).toContain('bucket.s3.amazonaws.com/k')
  })
})

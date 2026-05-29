import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Client } from 'iom-sdk'

import { downloadFileToClient } from '@/components/attachments/download-file'

vi.mock('@/lib', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

function makeClient(
  getDownloadUrl: () => Promise<{ url: string; expiresAt: string }> = () =>
    Promise.resolve({
      url: 'https://s3.example/presigned/u-1?sig=abc',
      expiresAt: '2099-01-01T00:00:00Z',
    })
): Client {
  return {
    fileStorage: { getDownloadUrl: vi.fn(getDownloadUrl) },
  } as unknown as Client
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('downloadFileToClient', () => {
  it('asks the SDK for a presigned URL and clicks an anchor pointing at it', async () => {
    const click = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = click
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(anchor)

    const client = makeClient()
    await downloadFileToClient(client, 'u-1', 'photo.png')

    expect(client.fileStorage.getDownloadUrl).toHaveBeenCalledWith('u-1')
    expect(anchor.href).toBe('https://s3.example/presigned/u-1?sig=abc')
    expect(anchor.download).toBe('photo.png')
    expect(click).toHaveBeenCalledTimes(1)
    expect(anchor.isConnected).toBe(false)
    createSpy.mockRestore()
  })

  it('rejects when the SDK call fails and never touches the DOM', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const client = makeClient(() =>
      Promise.reject(new Error('signing service down'))
    )

    await expect(downloadFileToClient(client, 'u-2', 'x.png')).rejects.toThrow(
      'signing service down'
    )

    expect(appendSpy).not.toHaveBeenCalled()
    appendSpy.mockRestore()
  })

  it('uses the requested filename as the download attribute', async () => {
    const anchor = document.createElement('a')
    anchor.click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor)

    await downloadFileToClient(makeClient(), 'u-3', 'report final v2.pdf')

    expect(anchor.download).toBe('report final v2.pdf')
  })
})

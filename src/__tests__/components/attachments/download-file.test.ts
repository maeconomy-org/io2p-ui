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
  getDownloadUrl: () => { url: string } = () => ({
    url: 'https://api.example/api/FileStorage/u-1/download',
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
  it('asks the SDK for a download URL and clicks an anchor', () => {
    const click = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = click
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(anchor)

    const client = makeClient()
    downloadFileToClient(client, 'u-1', 'photo.png')

    expect(client.fileStorage.getDownloadUrl).toHaveBeenCalledWith('u-1')
    expect(anchor.href).toBe('https://api.example/api/FileStorage/u-1/download')
    expect(anchor.download).toBe('photo.png')
    expect(click).toHaveBeenCalledTimes(1)
    expect(anchor.isConnected).toBe(false)
    createSpy.mockRestore()
  })

  it('rethrows when the SDK call fails and never touches the DOM', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const client = makeClient(() => {
      throw new Error('signing service down')
    })

    expect(() => downloadFileToClient(client, 'u-2', 'x.png')).toThrow(
      'signing service down'
    )

    expect(appendSpy).not.toHaveBeenCalled()
    appendSpy.mockRestore()
  })

  it('uses the requested filename as the download attribute', () => {
    const anchor = document.createElement('a')
    anchor.click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValueOnce(anchor)

    downloadFileToClient(makeClient(), 'u-3', 'report final v2.pdf')

    expect(anchor.download).toBe('report final v2.pdf')
  })
})

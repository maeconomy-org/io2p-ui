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

const createObjectURL = vi.fn((_blob: Blob) => 'blob:stub')
const revokeObjectURL = vi.fn((_url: string) => undefined)

function makeClient(overrides?: Partial<Client['node']>): Client {
  return {
    node: {
      getFileContent: vi.fn(async () => 'AAAA'),
      ...(overrides ?? {}),
    },
  } as unknown as Client
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(global.URL, 'createObjectURL', {
    value: createObjectURL,
    configurable: true,
  })
  Object.defineProperty(global.URL, 'revokeObjectURL', {
    value: revokeObjectURL,
    configurable: true,
  })
})

describe('downloadFileToClient', () => {
  it('creates and revokes a blob URL on success', async () => {
    const client = makeClient()
    await downloadFileToClient(client, 'u-1', 'image/png', 'photo.png')

    expect(client.node.getFileContent).toHaveBeenCalledWith('u-1')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub')
  })

  it('falls back to octet-stream when mime is empty', async () => {
    const client = makeClient()
    await downloadFileToClient(client, 'u-2', '', 'thing')

    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/octet-stream')
  })

  it('revokes the blob URL even if the download flow throws mid-way', async () => {
    const client = makeClient()
    const appendSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementationOnce(() => {
        throw new Error('dom boom')
      })

    await expect(
      downloadFileToClient(client, 'u-3', 'image/png', 'x.png')
    ).rejects.toThrow('dom boom')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub')
    appendSpy.mockRestore()
  })

  it('does not create a URL when the SDK download fails, and rethrows', async () => {
    const client = makeClient({
      getFileContent: vi.fn(async () => {
        throw new Error('net down')
      }),
    })

    await expect(
      downloadFileToClient(client, 'u-4', 'image/png', 'x.png')
    ).rejects.toThrow('net down')

    expect(createObjectURL).not.toHaveBeenCalled()
    expect(revokeObjectURL).not.toHaveBeenCalled()
  })

  it('sets the anchor download attribute to the requested filename', async () => {
    const click = vi.fn()
    const realAnchor = document.createElement('a')
    realAnchor.click = click
    const createSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValueOnce(realAnchor)

    await downloadFileToClient(makeClient(), 'u-5', 'text/plain', 'notes.txt')

    expect(realAnchor.download).toBe('notes.txt')
    expect(click).toHaveBeenCalledTimes(1)
    createSpy.mockRestore()
  })
})

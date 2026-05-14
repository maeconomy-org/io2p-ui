import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import type { Locator } from '@playwright/test'

/**
 * Synthesize a multi-file drop on a target locator. Reads the files from
 * disk (Node side), serializes them as base64, then constructs a real
 * `DataTransfer` inside the page and dispatches dragenter → dragover →
 * drop in sequence so react-dropzone's full event chain runs.
 *
 * Using Playwright's `setInputFiles` won't trigger react-dropzone — it
 * needs synthetic drag events, not file-input changes. This helper is the
 * canonical way to test drag-and-drop in this codebase.
 */
export async function dropFilesOn(
  target: Locator,
  filePaths: string[],
  options?: { mimeType?: string }
) {
  const filesPayload = await Promise.all(
    filePaths.map(async (path) => ({
      name: basename(path),
      type: options?.mimeType ?? guessMimeType(path),
      base64: (await readFile(path)).toString('base64'),
    }))
  )

  await target.evaluate(async (el, files) => {
    const dt = new DataTransfer()
    for (const f of files as Array<{
      name: string
      type: string
      base64: string
    }>) {
      const bin = atob(f.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      dt.items.add(new File([bytes], f.name, { type: f.type }))
    }
    const rect = (el as Element).getBoundingClientRect()
    const center = {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    }
    const fire = (type: string) =>
      (el as Element).dispatchEvent(
        new DragEvent(type, {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
          ...center,
        })
      )
    fire('dragenter')
    fire('dragover')
    fire('drop')
  }, filesPayload)
}

function guessMimeType(path: string): string {
  if (path.endsWith('.pdf')) return 'application/pdf'
  if (path.endsWith('.txt')) return 'text/plain'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.bin')) return 'application/octet-stream'
  return 'application/octet-stream'
}

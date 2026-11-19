import { open } from 'node:fs/promises'

// Size check and write go through ONE handle, so nothing can swap the file between them.
// `a+` creates a missing file; after the truncate, the append lands at offset 0.
export async function writeUnlessSize(path, expectedSize, bytes) {
  const file = await open(path, 'a+')
  try {
    if ((await file.stat()).size === expectedSize) return null
    const data = bytes()
    await file.truncate(0)
    await file.write(data)
    return data.length
  } finally {
    await file.close()
  }
}

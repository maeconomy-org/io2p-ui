/**
 * Decode a base64 string (no data-URL prefix) into a Blob.
 *
 * Uses `atob` + chunked `Uint8Array` fill rather than `fetch('data:...')` so we
 * are not subject to the browser's data-URL size ceiling (~30 MB in Firefox)
 * and keep peak memory close to 1× the raw payload.
 */
export async function base64ToBlob(
  base64: string,
  mimeType: string
): Promise<Blob> {
  const type = mimeType || 'application/octet-stream'
  try {
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type })
  } catch (err) {
    throw new Error(
      `Failed to decode base64 payload: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

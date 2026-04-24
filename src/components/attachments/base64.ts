/**
 * Decode a base64 string (no data-URL prefix) into a Blob via the browser's
 * native data-URL decoder. This avoids the `atob` + per-byte JS loop and keeps
 * peak memory close to 1× the raw payload.
 */
export async function base64ToBlob(
  base64: string,
  mimeType: string
): Promise<Blob> {
  const type = mimeType || 'application/octet-stream'
  const response = await fetch(`data:${type};base64,${base64}`)
  return response.blob()
}

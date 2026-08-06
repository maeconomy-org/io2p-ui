export type PreviewKind =
  | 'image'
  | 'pdf'
  | 'text'
  | 'video'
  | 'audio'
  | 'unsupported'

const EXTENSION_TO_MIME: Record<string, string> = {
  // images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  // documents
  pdf: 'application/pdf',
  // text
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  log: 'text/plain',
  yml: 'text/yaml',
  yaml: 'text/yaml',
  xml: 'application/xml',
  // video
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  ogv: 'video/ogg',
  // audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
}

export function detectMimeType(input: {
  contentType?: string | null
  fileName?: string | null
  fileReference?: string | null
}): string {
  const ct = input.contentType?.trim()
  if (ct && ct !== 'application/octet-stream') return ct.toLowerCase()

  const source = input.fileName || input.fileReference || ''
  const ext = source.split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  if (ext && EXTENSION_TO_MIME[ext]) return EXTENSION_TO_MIME[ext]

  return ct?.toLowerCase() || 'application/octet-stream'
}

export function detectPreviewKind(mime: string): PreviewKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/yaml'
  )
    return 'text'
  return 'unsupported'
}

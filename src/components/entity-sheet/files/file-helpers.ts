import { detectMimeType, detectPreviewKind } from './mime-type'
import type { DraftFile } from '@/lib/entity'

// A picked file → a pending upload draft (bytes ride the draft until Save; see plan §18).
export function newUploadDraft(file: File): DraftFile {
  return {
    _localId: crypto.randomUUID(),
    kind: 'upload',
    blob: file,
    fileName: file.name,
    contentType: file.type || undefined,
  }
}

// An external URL → a reference draft (never uploaded, never fetched by the node).
export function newReferenceDraft(url: string, label?: string): DraftFile {
  return {
    _localId: crypto.randomUUID(),
    kind: 'reference',
    reference: { url },
    label: label?.trim() || undefined,
  }
}

// Reference → its label/url; upload → its filename. Falls back to the id so a row always has text.
export function fileDisplayName(f: DraftFile): string {
  if (f.kind === 'reference')
    return f.label || f.reference?.url || f.id || 'link'
  return f.fileName || f.label || f.id || 'file'
}

export function isImageFile(f: DraftFile): boolean {
  return f.type === 'image' || (f.contentType?.startsWith('image/') ?? false)
}

/**
 * Can this file's bytes be fetched right now? The enricher skips soft-deleted and not-yet-ready
 * files, leaving a BARE `{id, kind}` ref with no metadata, and preview/download only resolve `ready`
 * non-deleted files — so offering a download for anything else just 404s.
 */
export function isResolvableUpload(f: DraftFile): boolean {
  return (
    f.kind === 'upload' &&
    !!f.id &&
    !!f.fileName &&
    !f.deleted &&
    (f.status ?? 'ready') === 'ready'
  )
}

/** Only stored, live bytes can be rendered in-app — a reference points at someone else's server. */
export function isPreviewable(f: DraftFile): boolean {
  return (
    isResolvableUpload(f) &&
    detectPreviewKind(detectMimeType(f)) !== 'unsupported'
  )
}

/**
 * Split a filename into the editable stem and its extension, so a rename can't accidentally drop or
 * mangle the suffix. A dotfile (`.env`) or an extensionless name is all stem.
 */
export function splitFileName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { stem: name, ext: '' }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

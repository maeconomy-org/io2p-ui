import type { DraftFile } from '@/lib/entity-body'

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

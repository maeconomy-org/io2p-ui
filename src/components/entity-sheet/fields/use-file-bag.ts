'use client'

import { useWatch, type UseFormReturn } from 'react-hook-form'

import type { DraftFile, EntityDraft } from '@/lib/entity'

import type { FilesPath } from './object-files-field'
import type { PropertiesPath } from './property-fields'

/** Every place a file list lives on the draft: the entity, a flow, a property, a value. */
export type FileBagPath =
  | FilesPath
  | `${PropertiesPath}.${number}.files`
  | `${PropertiesPath}.${number}.values.${number}.files`

export type FilePatch = (
  localId: string,
  patch: Partial<DraftFile>,
  options?: { dirty?: boolean }
) => void

export interface FileBagActions {
  add: (added: DraftFile[]) => void
  remove: (localId: string) => void
  patch: FilePatch
}

/**
 * Add, remove and patch one file list on the draft. A plain function, so a row can call it inside a
 * loop over its values. Each action reads the list when it runs, never a copy from an earlier render:
 * under the production-only React Compiler a captured copy froze, and a second add dropped the first.
 */
export function fileBagActions(
  form: UseFormReturn<EntityDraft>,
  path: FileBagPath
): FileBagActions {
  const current = () =>
    (form.getValues(path as FilesPath) as DraftFile[] | undefined) ?? []
  const write = (files: DraftFile[], dirty: boolean) =>
    form.setValue(path as FilesPath, files, { shouldDirty: dirty })

  return {
    add: (added) => write([...current(), ...added], true),
    remove: (localId) =>
      write(
        current().filter((f) => f._localId !== localId),
        true
      ),
    // Soft delete / restore already reached the server; the draft only catches up, so it stays
    // clean unless the caller says the change still needs saving.
    patch: (localId, patch, options) =>
      write(
        current().map((f) => (f._localId === localId ? { ...f, ...patch } : f)),
        options?.dirty ?? false
      ),
  }
}

/** The file list at `path`, kept current, with its actions. */
export function useFileBag(
  form: UseFormReturn<EntityDraft>,
  path: FileBagPath
): FileBagActions & { files: DraftFile[] } {
  // `useWatch`, not `form.watch`: this component receives the form rather than owning it, and a
  // `watch` here would read once and never re-render.
  const files =
    (useWatch({ control: form.control, name: path as FilesPath }) as
      | DraftFile[]
      | undefined) ?? []
  return { files, ...fileBagActions(form, path) }
}

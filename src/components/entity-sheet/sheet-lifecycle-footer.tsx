'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'

import { Button, SheetFooter } from '@/components/ui'
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { anchor } from '@/constants'

/**
 * The footer every entity sheet shares: view mode offers Edit and Delete, edit mode offers Cancel
 * and Save, and a soft-deleted entity offers only Restore.
 *
 * Delete opens a MODAL rather than asking for a second click on the button. The click-to-confirm
 * pattern is right for the many small deletions inside the sheet — a property, a value, a file —
 * where a dialog per row would be unbearable. Deleting the ENTITY is one rare, whole-record action,
 * and it deserves to name what it is about to remove.
 *
 * A deleted entity is shown rather than hidden, but it cannot be edited until it is restored — which
 * is why Restore replaces the whole set instead of sitting alongside Edit.
 */
export function SheetLifecycleFooter({
  editing,
  isCreate,
  isDeleted,
  isDirty,
  isSubmitting,
  lifecycleBusy,
  canEdit = true,
  readOnlyNote,
  canDelete,
  canRestore = canDelete,
  entityName,
  onEdit,
  onCancel,
  onDelete,
  onRestore,
}: {
  editing: boolean
  isCreate: boolean
  isDeleted: boolean
  isDirty: boolean
  isSubmitting: boolean
  lifecycleBusy: boolean
  /**
   * False when the viewer may read the entity but not write it — a built-in, or one shared with
   * them read-only. Omitting Edit rather than disabling it matches the row menus, and an enabled
   * control whose only outcome is a 403 on save is the failure this exists to prevent.
   */
  canEdit?: boolean
  /** Why the sheet is read-only, when `canEdit` is false. Defaults to the shared-with-you wording. */
  readOnlyNote?: string
  /** False while the entity has no id yet, or the caller has no delete for it. */
  canDelete: boolean
  /**
   * Restoring is guarded at the same rung as deleting — both are lifecycle writes — so it defaults
   * to `canDelete` rather than to `true`, where a `write` grantee would be offered a 403.
   */
  canRestore?: boolean
  /** Named in the confirmation, so the dialog says what it is about to delete. */
  entityName?: string
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
  onRestore: () => void
}) {
  const t = useTranslations()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Nothing this viewer can do to the entity — say so, rather than leaving an empty bar that reads
  // as a rendering fault.
  if (!canEdit) {
    return (
      <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
        <p
          className="text-sm text-muted-foreground"
          data-testid="sheet-read-only"
        >
          {readOnlyNote ?? t('common.sharedReadOnly')}
        </p>
      </SheetFooter>
    )
  }

  return (
    <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
      {isDeleted ? (
        canRestore ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={lifecycleBusy}
            data-testid="sheet-restore"
            onClick={onRestore}
          >
            {lifecycleBusy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            {t('common.restore')}
          </Button>
        ) : (
          // Restore is guarded at `admin`, so a `write` grantee reaches here with nothing to do —
          // and an empty bar reads as a rendering fault.
          <p
            className="text-sm text-muted-foreground"
            data-testid="sheet-read-only"
          >
            {t('common.deletedReadOnly')}
          </p>
        )
      ) : !editing ? (
        <>
          {canEdit && (
            <Button
              type="button"
              className="flex-1"
              data-testid="sheet-edit"
              onClick={onEdit}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {t('common.edit')}
            </Button>
          )}
          {!isCreate && canDelete && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={lifecycleBusy}
              data-testid="sheet-delete"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('common.delete')}
            </Button>
          )}
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            data-testid="sheet-cancel"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting || !isDirty}
            data-testid="sheet-save"
            {...anchor('sheetSubmit')}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </>
      )}

      <DeleteConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        objectName={entityName ?? ''}
        disabled={lifecycleBusy}
        onDelete={() => {
          setConfirmDelete(false)
          onDelete()
        }}
      />
    </SheetFooter>
  )
}

/** A dot on a tab whose fields the user has edited. */
export function DirtyDot({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span
      className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary"
      data-testid="sheet-tab-dirty"
    />
  )
}

/**
 * How many individual fields the user has actually changed. RHF's `dirtyFields` mirrors the value
 * shape, so arrays and objects nest — counting its top-level keys would call twelve edited properties
 * "1 unsaved change".
 */
export function countDirtyLeaves(node: unknown): number {
  if (node === true) return 1
  if (Array.isArray(node)) {
    return node.reduce<number>((n, child) => n + countDirtyLeaves(child), 0)
  }
  if (node && typeof node === 'object') {
    return Object.values(node).reduce<number>(
      (n, child) => n + countDirtyLeaves(child),
      0
    )
  }
  return 0
}

/** The sticky "N unsaved changes" strip above the footer. */
export function UnsavedBar({ count }: { count: number }) {
  const t = useTranslations()
  return (
    <div
      className="flex items-center gap-2 border-t bg-muted/40 px-6 py-2 text-sm"
      data-testid="unsaved-bar"
    >
      <span className="font-medium">
        {t('objects.detailsSheet.unsavedChanges', { count })}
      </span>
    </div>
  )
}

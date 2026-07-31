'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'

import { Button, SheetFooter } from '@/components/ui'
import { anchor } from '@/constants'

/**
 * The footer every entity sheet shares: view mode offers Edit and a two-step Delete, edit mode offers
 * Cancel and Save, and a soft-deleted entity offers only Restore.
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
  canDelete,
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
  /** False while the entity has no id yet, or the caller has no delete for it. */
  canDelete: boolean
  onEdit: () => void
  onCancel: () => void
  onDelete: () => void
  onRestore: () => void
}) {
  const t = useTranslations()
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
      {isDeleted ? (
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={lifecycleBusy}
          onClick={onRestore}
        >
          {lifecycleBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {t('common.restore')}
        </Button>
      ) : !editing ? (
        <>
          <Button type="button" className="flex-1" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            {t('common.edit')}
          </Button>
          {!isCreate && canDelete && (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={lifecycleBusy}
              // Blur resets the confirm so a half-pressed delete never lingers on a reopened sheet.
              onBlur={() => setConfirmDelete(false)}
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true)
                setConfirmDelete(false)
                onDelete()
              }}
            >
              {confirmDelete ? (
                t('common.confirm')
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
                </>
              )}
            </Button>
          )}
        </>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={isSubmitting || !isDirty}
            {...anchor('sheetSubmit')}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </>
      )}
    </SheetFooter>
  )
}

/** A dot on a tab whose fields the user has edited. */
export function DirtyDot({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
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
    <div className="flex items-center gap-2 border-t bg-muted/40 px-6 py-2 text-sm">
      <span className="font-medium">
        {t('objects.detailsSheet.unsavedChanges', { count })}
      </span>
    </div>
  )
}

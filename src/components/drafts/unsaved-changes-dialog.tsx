'use client'

import { useTranslations } from 'next-intl'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface UnsavedChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Number of edited leaves, so the copy can say what is at stake. */
  count: number
  /**
   * Omit to offer Discard / Cancel only. Saving a draft is a CREATE-flow affordance: an existing
   * entity already has a server copy, so a local draft of an edit would be a second source of truth
   * with no way to tell which is newer.
   */
  onSaveDraft?: () => void
  onDiscard: () => void
  /** Pending file picks cannot be serialized, so warn before they are dropped. */
  droppedUploads?: boolean
}

/**
 * The guard on closing a sheet with unsaved work. Replaces a `window.confirm`, which could only ask
 * yes/no — so the only answers available were "lose it" and "stay here", and a user who wanted to
 * come back later had neither.
 */
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  count,
  onSaveDraft,
  onDiscard,
  droppedUploads,
}: UnsavedChangesDialogProps) {
  const t = useTranslations()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="unsaved-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {onSaveDraft
              ? t('objects.drafts.unsaved.title')
              : t('objects.detailsSheet.discardConfirm')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {onSaveDraft
              ? t('objects.drafts.unsaved.description', { count })
              : t('objects.drafts.unsaved.descriptionEdit', { count })}
            {droppedUploads && (
              <span className="mt-2 block text-destructive">
                {t('objects.drafts.unsaved.uploadsDropped')}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex w-full gap-2">
          <AlertDialogCancel className="flex-1" data-testid="unsaved-cancel">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            // `hover:` too — buttonVariants() ships `hover:bg-primary/90`, so setting only the base
            // colour leaves the button turning blue under the cursor.
            className="flex-1 bg-destructive text-white hover:bg-destructive/90"
            data-testid="unsaved-discard"
            onClick={onDiscard}
          >
            {t('objects.drafts.actions.discard')}
          </AlertDialogAction>
          {onSaveDraft && (
            <AlertDialogAction
              className="flex-1"
              data-testid="unsaved-save-draft"
              onClick={onSaveDraft}
            >
              {t('objects.drafts.unsaved.saveDraft')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

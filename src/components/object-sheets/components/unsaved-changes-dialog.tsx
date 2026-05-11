'use client'

import { useTranslations } from 'next-intl'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui'
import { Button } from '@/components/ui'

interface UnsavedChangesDialogProps {
  open: boolean
  onDiscard: () => void
  onKeepEditing: () => void
  /** When provided, renders a third "Save as draft" action. */
  onSaveDraft?: () => void
}

export function UnsavedChangesDialog({
  open,
  onDiscard,
  onKeepEditing,
  onSaveDraft,
}: UnsavedChangesDialogProps) {
  const t = useTranslations()
  const showSaveDraft = typeof onSaveDraft === 'function'

  return (
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && onKeepEditing()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('objects.unsavedChanges.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {showSaveDraft
              ? t('objects.unsavedChanges.descriptionWithDraft')
              : t('objects.unsavedChanges.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepEditing}>
            {t('objects.unsavedChanges.keepEditing')}
          </AlertDialogCancel>
          {showSaveDraft && (
            <Button variant="secondary" onClick={onSaveDraft}>
              {t('objects.unsavedChanges.saveDraft')}
            </Button>
          )}
          <Button variant="destructive" onClick={onDiscard}>
            {t('objects.unsavedChanges.discard')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

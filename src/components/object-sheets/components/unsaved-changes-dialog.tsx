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
  AlertDialogAction,
} from '@/components/ui'
import { Button } from '@/components/ui'

interface UnsavedChangesDialogProps {
  open: boolean
  onDiscard: () => void
  onKeepEditing: () => void
}

export function UnsavedChangesDialog({
  open,
  onDiscard,
  onKeepEditing,
}: UnsavedChangesDialogProps) {
  const t = useTranslations()

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
            {t('objects.unsavedChanges.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onKeepEditing}>
            {t('objects.unsavedChanges.keepEditing')}
          </AlertDialogCancel>
          <Button variant="destructive" onClick={onDiscard}>
            {t('objects.unsavedChanges.discard')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

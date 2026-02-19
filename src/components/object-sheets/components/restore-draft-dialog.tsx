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

interface RestoreDraftDialogProps {
  open: boolean
  onRestore: () => void
  onStartFresh: () => void
}

export function RestoreDraftDialog({
  open,
  onRestore,
  onStartFresh,
}: RestoreDraftDialogProps) {
  const t = useTranslations()

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('objects.restoreDraft.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('objects.restoreDraft.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStartFresh}>
            {t('objects.restoreDraft.startFresh')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRestore}>
            {t('objects.restoreDraft.continueEditing')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { useTranslations } from 'next-intl'

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectName: string
  onDelete: () => void
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  objectName,
  onDelete,
}: DeleteConfirmationDialogProps) {
  const t = useTranslations()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('objects.deleteConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('objects.deleteConfirmDescription', { name: objectName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex w-full gap-2">
          <AlertDialogCancel className="flex-1">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white flex-1"
            onClick={onDelete}
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

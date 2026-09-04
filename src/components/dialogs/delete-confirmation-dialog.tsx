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
  /** Overrides for destructive actions that are not a delete — revoking access, for one. */
  title?: string
  description?: string
  confirmLabel?: string
  disabled?: boolean
}

/**
 * The confirmation for any irreversible action, not just delete.
 *
 * The copy defaults to the delete wording because that is most callers, but the shape — a red
 * confirm at equal weight to Cancel — is what every destructive action needs, so it takes overrides
 * rather than being copied. (The name still says Delete; renaming it is a separate sweep.)
 */
export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  objectName,
  onDelete,
  title,
  description,
  confirmLabel,
  disabled,
}: DeleteConfirmationDialogProps) {
  const t = useTranslations()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title ?? t('objects.deleteConfirmTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              t('objects.deleteConfirmDescription', { name: objectName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex w-full gap-2">
          <AlertDialogCancel className="flex-1" disabled={disabled}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            // `hover:` too — `buttonVariants()` ships `hover:bg-primary/90`, so overriding only
            // the base colour leaves the button turning blue under the cursor.
            className="flex-1 bg-destructive text-white hover:bg-destructive/90"
            disabled={disabled}
            onClick={onDelete}
          >
            {confirmLabel ?? t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

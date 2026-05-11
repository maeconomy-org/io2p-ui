'use client'

import { MouseEvent, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, Trash2 } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui'

interface DraftActionsCellProps {
  draftId: string
  onOpen: (id: string) => void
  onDiscard: (id: string) => void
}

/**
 * Actions cell for draft rows. Mirrors the split-button layout of
 * `ObjectActionsCell` (primary action on the left, dropdown trigger on the
 * right) so draft rows feel native alongside real object rows. Primary action
 * is "Open" (analog of "View details"); dropdown holds the destructive
 * "Discard" with an inline confirmation dialog.
 */
export function DraftActionsCell({
  draftId,
  onOpen,
  onDiscard,
}: DraftActionsCellProps) {
  const t = useTranslations()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleOpen = (e: MouseEvent) => {
    e.stopPropagation()
    onOpen(draftId)
  }

  const handleConfirmDiscard = () => {
    setConfirmOpen(false)
    onDiscard(draftId)
  }

  return (
    <>
      <div className="flex justify-end">
        <div className="inline-flex items-center rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-r-none border-r px-2.5 text-xs"
            onClick={handleOpen}
            data-testid="draft-open-button"
          >
            {t('objects.drafts.actions.open')}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-l-none"
                onClick={(e) => e.stopPropagation()}
                aria-label={t('objects.drafts.actions.more')}
                data-testid="draft-actions-dropdown"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setConfirmOpen(true)
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('objects.drafts.actions.discard')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('objects.drafts.discardConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('objects.drafts.discardConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('objects.drafts.discardConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

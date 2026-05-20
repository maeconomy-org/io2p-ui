'use client'

import { useState, type MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, FolderOpen, MoreHorizontal, Trash2 } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

type DraftActionsVariant = 'split' | 'kebab'

interface DraftActionsProps {
  draftId: string
  onOpen: (id: string) => void
  onDiscard: (id: string) => void
  /**
   * Layout. `split` is the wide table-row affordance (primary Open button +
   * chevron dropdown for Discard). `kebab` is the compact MoreHorizontal
   * dropdown used in narrow list surfaces, with Open + Discard both inside
   * the menu. Defaults to `split` to match the most common existing usage.
   */
  variant?: DraftActionsVariant
}

/**
 * Unified draft row actions. Owns the confirm-discard flow (state + dialog +
 * destructive copy) so the destructive path stays consistent across surfaces;
 * only the trigger UI forks on the variant.
 */
export function DraftActions({
  draftId,
  onOpen,
  onDiscard,
  variant = 'split',
}: DraftActionsProps) {
  const t = useTranslations()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handlePrimaryOpen = (e: MouseEvent) => {
    e.stopPropagation()
    onOpen(draftId)
  }

  const handleConfirmDiscard = () => {
    setConfirmOpen(false)
    onDiscard(draftId)
  }

  return (
    <>
      {variant === 'split' ? (
        <div className="flex justify-end">
          <div className="inline-flex items-center rounded-md border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-r-none border-r px-2.5 text-xs"
              onClick={handlePrimaryOpen}
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
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label={t('objects.drafts.actions.more')}
              data-testid="draft-actions-dropdown"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                onOpen(draftId)
              }}
              data-testid="draft-open-button"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('objects.drafts.actions.open')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
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
      )}

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

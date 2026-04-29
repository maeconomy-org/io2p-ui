'use client'

import { useTranslations } from 'next-intl'
import { Loader2, X } from 'lucide-react'

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'

import { useObjectData } from '../hooks'
import { PassportView } from './passport-view'

interface ProductPassportSheetProps {
  isOpen: boolean
  onClose: () => void
  uuid?: string
  /** Optional fallback object so the title shows immediately while data loads. */
  object?: { uuid?: string; name?: string; abbreviation?: string } | null
}

/**
 * Standalone, wider product-passport sheet opened from the objects table row
 * dropdown. Reuses `PassportView` for the actual rendering — this wrapper just
 * fetches the aggregate and provides the sheet chrome.
 */
export function ProductPassportSheet({
  isOpen,
  onClose,
  uuid,
  object: initialObject,
}: ProductPassportSheetProps) {
  const t = useTranslations()

  const { object, properties, files, addressInfo, isLoading } = useObjectData({
    uuid,
    initialObject: initialObject ?? undefined,
    isOpen,
  })

  const displayName =
    object?.name ?? initialObject?.name ?? t('objects.passport.untitled')

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="sm:max-w-4xl flex flex-col"
        data-testid="product-passport-sheet"
      >
        {/* Title + description are required for Radix a11y but visually
            redundant — the passport hero below repeats the name and purpose,
            so we hide them from sighted users while keeping screen-reader
            output intact. */}
        <SheetHeader className="sr-only">
          <SheetTitle>{displayName}</SheetTitle>
          <SheetDescription>
            {t('objects.passport.sheetDescription')}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center items-center flex-1">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-1 -mx-1">
            <PassportView
              object={object}
              properties={properties}
              files={files}
              addressInfo={addressInfo}
            />
          </div>
        )}

        <div
          className="flex-shrink-0 flex items-center justify-end gap-2 border-t pt-3 mt-2"
          data-testid="passport-footer"
        >
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
            data-testid="passport-close-button"
          >
            <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            {t('common.close')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

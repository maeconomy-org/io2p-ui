'use client'

import { MouseEvent } from 'react'
import { useTranslations } from 'next-intl'
import {
  FileText,
  Trash2,
  QrCode,
  RotateCcw,
  Copy,
  ChevronDown,
} from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'

interface ObjectActionsCellProps {
  /** The object to perform actions on */
  object: any
  /** Whether the object is soft-deleted */
  isDeleted: boolean
  /** Callback when "View Details" is clicked */
  onViewDetails: (object: any) => void
  /** Callback when "Show QR Code" is clicked */
  onShowQRCode: (object: any, e: MouseEvent) => void
  /** Callback when "Duplicate" is clicked */
  onDuplicate: (object: any) => void
  /** Callback when "Create Template" is clicked */
  onCreateTemplate: (object: any) => void
  /** Callback when "Delete" is clicked */
  onDelete: (object: any) => void
  /** Callback when "Restore" is clicked */
  onRestore: (object: any) => void
  /** Whether delete action is pending */
  isDeleting?: boolean
  /** Whether restore action is pending */
  isRestoring?: boolean
  /** Whether the user is in read-only mode (no edit/delete actions) */
  readOnly?: boolean
}

/**
 * Actions cell for object table rows.
 * Shows "View Details" button with dropdown for additional actions.
 */
export function ObjectActionsCell({
  object,
  isDeleted,
  onViewDetails,
  onShowQRCode,
  onDuplicate,
  onCreateTemplate,
  onDelete,
  onRestore,
  isDeleting = false,
  isRestoring = false,
  readOnly = false,
}: ObjectActionsCellProps) {
  const t = useTranslations()

  if (readOnly) {
    return (
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2.5 text-xs border rounded-md"
          onClick={(e) => {
            e.stopPropagation()
            onViewDetails(object)
          }}
          data-testid="object-details-button"
        >
          {t('objects.viewDetails')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center rounded-md border">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-r-none border-r px-2.5 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            onViewDetails(object)
          }}
          data-testid="object-details-button"
        >
          {t('objects.viewDetails')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-l-none"
              onClick={(e) => e.stopPropagation()}
              data-testid="object-actions-dropdown"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => onShowQRCode(object, e)}>
              <QrCode className="h-4 w-4 mr-2" />
              {t('objects.actions.showQrCode')}
            </DropdownMenuItem>
            {!isDeleted && (
              <>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(object)
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {t('objects.duplicate.action')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateTemplate(object)
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {t('objects.createTemplate')}
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            {isDeleted ? (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onRestore(object)
                }}
                disabled={isRestoring}
              >
                <RotateCcw className="h-4 w-4 mr-2 text-blue-600" />
                {t('objects.restoreTitle')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(object)
                }}
                disabled={isDeleting}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('common.delete')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

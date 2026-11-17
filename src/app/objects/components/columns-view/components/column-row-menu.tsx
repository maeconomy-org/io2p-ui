'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  Copy,
  FileText,
  MoreHorizontal,
  QrCode,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import type { ObjectListItem } from 'io2p-client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { canDelete, type permissionWhenKnown } from '@/components/entity-list'
import { copyText } from '@/lib/clipboard'

export interface MillerColumnActions {
  onViewObject?: (o: ObjectListItem) => void
  onDelete?: (o: ObjectListItem) => void
  onDuplicate?: (o: ObjectListItem) => void
  onShowQRCode?: (o: ObjectListItem) => void
  onCreateTemplate?: (o: ObjectListItem) => void
  onRestore?: (o: ObjectListItem) => void
}

interface ColumnRowMenuProps extends MillerColumnActions {
  item: ObjectListItem
  permission: ReturnType<typeof permissionWhenKnown>
  isRestoring: boolean
}

export function ColumnRowMenu({
  item,
  permission,
  isRestoring,
  onViewObject,
  onDelete,
  onDuplicate,
  onShowQRCode,
  onCreateTemplate,
  onRestore,
}: ColumnRowMenuProps) {
  const t = useTranslations()
  const isDeleted = item.deleted

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-6 w-6 text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
          aria-label={t('common.actions')}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onViewObject?.(item)}>
          <FileText className="mr-2 h-4 w-4" />
          {t('objects.viewDetails')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            const ok = await copyText(item.id)
            toast[ok ? 'success' : 'error'](
              ok
                ? t('copyButton.copiedWithLabel', { label: 'UUID' })
                : t('copyButton.failedToCopy')
            )
          }}
        >
          <Copy className="mr-2 h-4 w-4" />
          {t('objects.actions.copyUuid')}
        </DropdownMenuItem>
        {onShowQRCode && (
          <DropdownMenuItem onClick={() => onShowQRCode(item)}>
            <QrCode className="mr-2 h-4 w-4" />
            {t('objects.actions.showQrCode')}
          </DropdownMenuItem>
        )}
        {onDuplicate && !isDeleted && (
          <DropdownMenuItem onClick={() => onDuplicate(item)}>
            <Copy className="mr-2 h-4 w-4" />
            {t('objects.duplicate.action')}
          </DropdownMenuItem>
        )}
        {onCreateTemplate && !isDeleted && (
          <DropdownMenuItem onClick={() => onCreateTemplate(item)}>
            <FileText className="mr-2 h-4 w-4" />
            {t('objects.createTemplate')}
          </DropdownMenuItem>
        )}
        {(onDelete || onRestore) && canDelete(permission) && (
          <>
            <DropdownMenuSeparator />
            {isDeleted
              ? onRestore && (
                  <DropdownMenuItem
                    onClick={() => onRestore(item)}
                    disabled={isRestoring}
                  >
                    <RotateCcw className="mr-2 h-4 w-4 text-blue-600" />
                    {t('objects.restoreTitle')}
                  </DropdownMenuItem>
                )
              : onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('common.delete')}
                  </DropdownMenuItem>
                )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

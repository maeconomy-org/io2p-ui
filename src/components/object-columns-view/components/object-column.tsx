'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  ChevronRight,
  Copy,
  FileText,
  IdCard,
  MoreHorizontal,
  QrCode,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import {
  Button,
  ScrollArea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui'
import { truncateText } from '@/lib'
import { DraftBadge, DraftActions } from '@/components/object-sheets/components'
import { hasChildren } from '../utils'
import { ColumnHeader } from './column-header'

// Define interfaces for our data
interface Property {
  uuid: string
  key: string
  value?: string
  values?: { value: string }[]
}

interface ObjectItem {
  uuid: string
  name: string
  modelUuid?: string
  modelName?: string
  modelVersion?: string
  properties?: Property[]
  children?: ObjectItem[]
  hasChildren?: boolean
  childCount?: number
  createdAt: string
  updatedAt: string
  files?: any[]
  softDeleted?: boolean
  softDeletedAt?: string
  softDeleteBy?: string
  description?: string
}

interface ObjectColumnProps {
  items: ObjectItem[]
  selectedId: string | null
  isLoading?: boolean
  pagination?: {
    currentPage: number
    totalPages: number
    totalItems: number
    onPageChange: (page: number) => void
  }
  onSelect: (item: ObjectItem) => void
  onShowDetails: (item: ObjectItem) => void
  onDelete?: (item: ObjectItem) => void
  onDuplicate?: (item: ObjectItem) => void
  onShowQRCode?: (item: ObjectItem) => void
  onViewPassport?: (item: ObjectItem) => void
  onCreateTemplate?: (item: ObjectItem) => void
  onRestore?: (item: ObjectItem) => void
  isRestoring?: boolean
  searchTerm?: string
  onSearchChange?: (search: string) => void
  columnTitle?: string
  // Draft handlers — only provided to the root column. When set, items with
  // an `__isDraft` flag render as draft entries (badge + open/discard split
  // button) instead of normal rows.
  onOpenDraft?: (id: string) => void
  onDiscardDraft?: (id: string) => void
}

export function ObjectColumn({
  items,
  selectedId,
  isLoading = false,
  pagination,
  onSelect,
  onShowDetails,
  onDelete,
  onDuplicate,
  onShowQRCode,
  onViewPassport,
  onCreateTemplate,
  onRestore,
  isRestoring = false,
  searchTerm = '',
  onSearchChange,
  columnTitle,
  onOpenDraft,
  onDiscardDraft,
}: ObjectColumnProps) {
  const t = useTranslations()
  const title = columnTitle ?? t('objects.title')
  // Get icon based on object type
  const getIcon = () => {
    return <FileText size={16} />
  }

  // For server-side search, we'll filter on the server
  // For now, keep client-side filtering until server-side search is implemented
  const filteredItems = items.filter((item) => {
    if (!searchTerm.trim()) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      item.name?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.uuid?.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="flex-1 min-w-[250px] max-w-[300px] h-full border-r overflow-hidden flex flex-col">
      {/* Column Header with Search & Pagination */}
      <ColumnHeader
        title={title}
        searchTerm={searchTerm}
        onSearchChange={onSearchChange || (() => {})}
        itemCount={filteredItems.length}
        pagination={pagination}
        isLoading={isLoading}
      />

      <ScrollArea className="flex-1">
        <div className="px-1 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2"></div>
              <span className="text-sm text-muted-foreground">
                {t('objects.loadingChildren')}
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-center">
              <div className="text-sm text-muted-foreground">
                {searchTerm
                  ? t('objects.noItemsMatch')
                  : t('objects.noItemsColumn')}
              </div>
            </div>
          ) : (
            filteredItems.map((item) => {
              // Draft entries are UI-only rows surfaced by the parent page.
              // They have no backend uuid and no children — clicking does not
              // select (nothing to load); double-click opens the draft sheet.
              const draftItem = item as any
              if (draftItem.__isDraft) {
                const displayName =
                  (draftItem.name as string)?.trim() ||
                  t('objects.drafts.untitled')
                return (
                  <div
                    key={draftItem.__draftId}
                    className="flex items-center justify-between p-2 rounded-md cursor-pointer mb-1 hover:bg-muted/50"
                    onDoubleClick={() => onOpenDraft?.(draftItem.__draftId)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium select-none truncate">
                          {truncateText(displayName, 22, true)}
                        </span>
                        <DraftBadge className="shrink-0" />
                      </div>
                    </div>
                    {onOpenDraft && onDiscardDraft && (
                      <DraftActions
                        variant="kebab"
                        draftId={draftItem.__draftId}
                        onOpen={onOpenDraft}
                        onDiscard={onDiscardDraft}
                      />
                    )}
                  </div>
                )
              }

              const isSelected = item.uuid === selectedId
              const itemHasChildren = hasChildren(item)
              const isSoftDeleted =
                Boolean(item.softDeleted) || Boolean(item.softDeletedAt)

              return (
                <div
                  key={item.uuid}
                  className={`
                  flex items-center justify-between p-2 rounded-md cursor-pointer mb-1
                  ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                  ${isSoftDeleted ? 'bg-red-50 border border-red-200' : ''}
                `}
                  onClick={() => onSelect(item)}
                  onDoubleClick={() => onShowDetails(item)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium select-none truncate ${isSoftDeleted ? 'text-red-600 line-through' : ''}`}
                        >
                          {truncateText(
                            item.name || t('objects.unnamed'),
                            25,
                            true
                          )}
                        </span>
                        {itemHasChildren && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 shrink-0">
                            {item.childCount || item.children?.length || 0}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onShowDetails(item)}>
                          <FileText className="h-4 w-4 mr-2" />
                          {t('objects.viewDetails')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(item.uuid)
                            toast.success(
                              t('copyButton.copiedWithLabel', { label: 'UUID' })
                            )
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          {t('objects.actions.copyUuid')}
                        </DropdownMenuItem>
                        {onViewPassport && (
                          <DropdownMenuItem
                            onClick={() => onViewPassport(item)}
                          >
                            <IdCard className="h-4 w-4 mr-2" />
                            {t('objects.actions.viewPassport')}
                          </DropdownMenuItem>
                        )}
                        {onShowQRCode && (
                          <DropdownMenuItem onClick={() => onShowQRCode(item)}>
                            <QrCode className="h-4 w-4 mr-2" />
                            {t('objects.actions.showQrCode')}
                          </DropdownMenuItem>
                        )}
                        {onDuplicate && !isSoftDeleted && (
                          <DropdownMenuItem onClick={() => onDuplicate(item)}>
                            <Copy className="h-4 w-4 mr-2" />
                            {t('objects.duplicate.action')}
                          </DropdownMenuItem>
                        )}
                        {onCreateTemplate && !isSoftDeleted && (
                          <DropdownMenuItem
                            onClick={() => onCreateTemplate(item)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            {t('objects.createTemplate')}
                          </DropdownMenuItem>
                        )}
                        {(onDelete || onRestore) && (
                          <>
                            <DropdownMenuSeparator />
                            {isSoftDeleted
                              ? onRestore && (
                                  <DropdownMenuItem
                                    onClick={() => onRestore(item)}
                                    disabled={isRestoring}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2 text-blue-600" />
                                    {t('objects.restoreTitle')}
                                  </DropdownMenuItem>
                                )
                              : onDelete && (
                                  <DropdownMenuItem
                                    onClick={() => onDelete(item)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t('common.delete')}
                                  </DropdownMenuItem>
                                )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {itemHasChildren && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-1" />
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

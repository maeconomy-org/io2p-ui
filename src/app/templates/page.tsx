'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { PlusCircle, FileText, Package, Share2, Workflow } from 'lucide-react'
import dynamic from 'next/dynamic'
import type { CreateTemplateInput, TemplateListItem } from 'io2p-client'

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  ownerSection,
  scopeSection,
  type OwnerFilterValue,
} from '@/components/filters'
import {
  BulkActionBar,
  EntityTable,
  canWriteLibraryItem,
  useEntityListActions,
  useEntityListFilters,
  useEntityListQuery,
} from '@/components/entity-list'
import { SearchResultsBar } from '@/components/search-results-bar'
import { useTemplates } from '@/hooks/api/entities'
import { useScopePreference } from '@/hooks/ui/use-scope-preference'
import { useAuth, useSearch } from '@/contexts'
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { anchor } from '@/constants'
import { PageHelp } from '@/components/onboarding/page-help'
import {
  TOUR_ACTIONS,
  useTourAction,
} from '@/components/onboarding/use-tour-action'

import { buildTemplateColumns } from './components/template-columns'
import {
  templateTypeSection,
  type TemplateTypeFilterValue,
} from './components/template-type-filter'

// Lazy-load sheet components — only rendered when opened by user interaction
const ShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.ShareSheet),
  { ssr: false }
)
const LibraryBulkShareSheet = dynamic(
  () => import('@/components/access').then((mod) => mod.LibraryBulkShareSheet),
  { ssr: false }
)
const TemplateSheet = dynamic(
  () => import('@/components/entity-sheet').then((mod) => mod.TemplateSheet),
  { ssr: false }
)

const TEMPLATE_MESSAGES = {
  deleted: 'templates.deleted',
  deleteFailed: 'templates.deleteFailed',
  restored: 'templates.restored',
  restoreFailed: 'templates.restoreFailed',
}

export default function TemplatesPage() {
  const t = useTranslations()

  const [templateSheetOpen, setTemplateSheetOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateListItem | null>(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)
  const [scope, setScope, defaultScope] = useScopePreference('templateScope')
  const [typeFilter, setTypeFilter] = useState<TemplateTypeFilterValue>()
  // Which kind a CREATE will be. An edit takes the loaded template's own type.
  const [createType, setCreateType] =
    useState<NonNullable<CreateTemplateInput['type']>>('object')
  const [shareTarget, setShareTarget] = useState<TemplateListItem | null>(null)
  const [bulkShareOpen, setBulkShareOpen] = useState(false)

  const { isSearchMode, searchQuery, clearSearch } = useSearch()
  const { userId } = useAuth()

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useTemplates()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()
  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))

  const { data: templatesPage, isFetching } = useList(
    {
      ...listQuery.query,
      size: filters.pageSize,
      scope,
      q: isSearchMode ? searchQuery : undefined,
      deleted: filters.showDeleted ? 'include' : undefined,
      system: owner,
      type: typeFilter,
    },
    { keepPreviousData: true }
  )

  const handleAddTemplate = useCallback(
    (type: NonNullable<CreateTemplateInput['type']>) => {
      setCreateType(type)
      setSelectedTemplate(null)
      setOpenInEditMode(false)
      setTemplateSheetOpen(true)
    },
    []
  )

  // The tour opens the sheet through the page's own handler rather than by
  // synthesising clicks on a dropdown trigger.
  useTourAction(TOUR_ACTIONS.createTemplate, () => handleAddTemplate('object'))
  useTourAction(TOUR_ACTIONS.closeSheet, () => setTemplateSheetOpen(false))

  const openTemplate = useCallback(
    (template: TemplateListItem, edit: boolean) => {
      setSelectedTemplate(template)
      setOpenInEditMode(edit)
      setTemplateSheetOpen(true)
    },
    []
  )

  const list = useEntityListActions({
    page: templatesPage,
    remove: removeMutation,
    restore: restoreMutation,
    entityName: 'template',
    canAct: (row) => canWriteLibraryItem(row, userId),
    messages: TEMPLATE_MESSAGES,
  })

  const columns = useMemo(
    () =>
      buildTemplateColumns({
        t,
        actions: {
          onViewDetails: (template) => openTemplate(template, false),
          onEdit: (template) => openTemplate(template, true),
          onShare: setShareTarget,
          onDelete: list.setToDelete,
          onRestore: list.handleRestore,
        },
      }),
    [t, openTemplate, list.setToDelete, list.handleRestore]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold">{t('templates.title')}</h2>
              <PageHelp concept="template" tour="build-template" />
            </div>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  templateTypeSection(t, typeFilter, setTypeFilter),
                  scopeSection(t, scope, setScope, defaultScope),
                  ownerSection(t, owner, setOwner),
                  deletedSection(
                    t,
                    filters.showDeleted,
                    filters.setShowDeleted
                  ),
                ]}
              />
              {/* One list holds both kinds, so the button has to ask which — the page no longer
                  implies one. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" {...anchor('templatesCreate')}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('templates.create')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => handleAddTemplate('object')}
                    {...anchor('templatesCreateObject')}
                  >
                    <Package className="mr-2 h-4 w-4" />
                    {t('templates.createObject')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => handleAddTemplate('process')}
                  >
                    <Workflow className="mr-2 h-4 w-4" />
                    {t('templates.createProcess')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {isSearchMode && (
            <SearchResultsBar
              searchQuery={searchQuery}
              resultsCount={templatesPage?.page.totalElements ?? 0}
              onClearSearch={clearSearch}
              raised={list.selectedRows.length > 0}
            />
          )}

          <EntityTable
            columns={columns}
            page={templatesPage}
            getRowId={(template) => template.id}
            fetching={isFetching}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            enableRowSelection
            rowSelection={list.rowSelection}
            onRowSelectionChange={list.setRowSelection}
            onPageChange={listQuery.setPage}
            onPageSizeChange={filters.handlePageSizeChange}
            pageSize={filters.pageSize}
            emptyIcon={
              <FileText className="h-10 w-10 text-muted-foreground/50" />
            }
            emptyTitle={t('templates.noTemplatesTitle')}
            emptyDescription={t('templates.noTemplatesDescription')}
            emptyAction={
              <Button size="sm" onClick={() => handleAddTemplate('object')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('templates.noTemplatesAction')}
              </Button>
            }
          />
        </div>
      </div>

      {templateSheetOpen && (
        <TemplateSheet
          open={templateSheetOpen}
          onOpenChange={setTemplateSheetOpen}
          templateId={selectedTemplate?.id}
          initialEditing={openInEditMode}
          type={createType}
        />
      )}

      {shareTarget && (
        <ShareSheet
          open
          onOpenChange={(open) => !open && setShareTarget(null)}
          target={{
            type: 'template',
            id: shareTarget.id,
            name: shareTarget.name,
          }}
          isOwner={shareTarget.ownerUserId === userId}
        />
      )}

      <BulkActionBar
        count={list.selectedRows.length}
        onClear={list.clearSelection}
        canDelete={list.anyLive}
        canRestore={list.anyDeleted}
        busy={list.isBusy}
        onDelete={() => list.setConfirmBulk(true)}
        onRestore={() => list.runBulk('restore')}
        actions={[
          {
            key: 'share',
            // A bundle needs `share` on EVERY resource or the node refuses the whole call, so a
            // selection mixing yours with someone else's would fail as a unit.
            label: t('access.share'),
            icon: Share2,
            hidden: list.actionableRows.length === 0,
            actionable: list.actionableRows.length,
            onSelect: () => setBulkShareOpen(true),
          },
        ]}
      />

      {bulkShareOpen && (
        <LibraryBulkShareSheet
          open
          onOpenChange={(open) => !open && setBulkShareOpen(false)}
          resources={list.actionableRows.map((row) => ({
            type: 'template' as const,
            id: row.id,
            name: row.name,
          }))}
          onDone={list.clearSelection}
        />
      )}

      <DeleteConfirmationDialog
        open={list.confirmBulk}
        onOpenChange={list.setConfirmBulk}
        objectName=""
        title={t('common.bulk.deleteTitle')}
        description={t('common.bulk.deleteDescription', {
          count: list.deletableCount,
        })}
        onDelete={() => list.runBulk('delete')}
      />

      <DeleteConfirmationDialog
        open={!!list.toDelete}
        onOpenChange={(open) => !open && list.setToDelete(null)}
        onDelete={list.confirmDelete}
        objectName={list.toDelete?.name || t('templates.defaultName')}
      />
    </>
  )
}

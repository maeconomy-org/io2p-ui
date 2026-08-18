'use client'

import { useState, useCallback, useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { PlusCircle, Sigma } from 'lucide-react'
import dynamic from 'next/dynamic'

import { Button } from '@/components/ui'
import {
  FilterMenu,
  deletedSection,
  ownerSection,
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
import { DeleteConfirmationDialog } from '@/components/dialogs'
import { useAuth } from '@/contexts'
import { PageHelp } from '@/components/onboarding/page-help'
import { anchor, type PropertyDictionaryLocale } from '@/constants'

import {
  buildRollupRuleColumns,
  type RollupRuleColumnActions,
} from './components/rollup-rule-columns'
import { useRollupRules } from './hooks/use-rollup-rules'
import type { RollupRuleDTO } from './lib/rollup-rule'

const RollupRuleSheet = dynamic(
  () => import('./components/rollup-rule-sheet').then((m) => m.RollupRuleSheet),
  { ssr: false }
)

type SheetState = { mode: 'create' } | { mode: 'view'; rule: RollupRuleDTO }

const ROLLUP_RULE_MESSAGES = {
  deleted: 'rollupRules.deleted',
  deleteFailed: 'rollupRules.deleteFailed',
  restored: 'rollupRules.restored',
  restoreFailed: 'rollupRules.restoreFailed',
}

export default function RollupRulesPage() {
  const t = useTranslations()
  const { userId } = useAuth()
  const locale = useLocale() as PropertyDictionaryLocale

  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [owner, setOwner] = useState<OwnerFilterValue>(undefined)

  const listQuery = useEntityListQuery()
  const { useList, useRemove, useRestore } = useRollupRules()
  const removeMutation = useRemove()
  const restoreMutation = useRestore()

  const setPage = listQuery.setPage
  const filters = useEntityListFilters(useCallback(() => setPage(1), [setPage]))

  // Built explicitly rather than spread from `listQuery.query`: that carries `q` and `scope`, and
  // this resource has neither — a rule is the node's or yours, and there is nothing to search.
  const { data: rulesPage, isFetching } = useList(
    {
      page: listQuery.query.page,
      size: filters.pageSize,
      sort:
        listQuery.query.sort === 'createdAt' ||
        listQuery.query.sort === '-createdAt'
          ? listQuery.query.sort
          : undefined,
      system: owner,
      deleted: filters.showDeleted ? 'include' : undefined,
    },
    { keepPreviousData: true }
  )

  const list = useEntityListActions({
    page: rulesPage,
    remove: removeMutation,
    restore: restoreMutation,
    entityName: 'rollup rule',
    messages: ROLLUP_RULE_MESSAGES,
    canAct: (rule) => canWriteLibraryItem(rule, userId),
  })

  const actions: RollupRuleColumnActions = useMemo(
    () => ({
      onViewDetails: (rule) => setSheet({ mode: 'view', rule }),
      onDelete: list.setToDelete,
      onRestore: list.handleRestore,
    }),
    [list.setToDelete, list.handleRestore]
  )

  const columns = useMemo(
    () => buildRollupRuleColumns({ t, locale, actions }),
    [t, locale, actions]
  )

  return (
    <>
      <div className="container mx-auto flex-1 p-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h2 className="text-2xl font-semibold">
                {t('rollupRules.title')}
              </h2>
              <PageHelp concept="rollupRule" />
            </div>
            <div className="flex items-center gap-2">
              <FilterMenu
                sections={[
                  ownerSection(t, owner, setOwner),
                  deletedSection(
                    t,
                    filters.showDeleted,
                    filters.setShowDeleted
                  ),
                ]}
              />
              <Button
                size="sm"
                onClick={() => setSheet({ mode: 'create' })}
                {...anchor('rollupRulesCreate')}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {t('rollupRules.createTitle')}
              </Button>
            </div>
          </div>

          <EntityTable
            columns={columns}
            page={rulesPage}
            getRowId={(rule) => rule.id}
            fetching={isFetching}
            sort={listQuery.query.sort}
            onSortChange={listQuery.setSort}
            enableRowSelection
            rowSelection={list.rowSelection}
            onRowSelectionChange={list.setRowSelection}
            onPageChange={listQuery.setPage}
            onPageSizeChange={filters.handlePageSizeChange}
            pageSize={filters.pageSize}
            onRowClick={(rule) => setSheet({ mode: 'view', rule })}
            emptyIcon={<Sigma className="h-10 w-10 text-muted-foreground/50" />}
            emptyTitle={t('rollupRules.empty.title')}
            emptyDescription={t('rollupRules.empty.description')}
          />
        </div>
      </div>

      {sheet && (
        <RollupRuleSheet
          open
          onOpenChange={(open) => !open && setSheet(null)}
          mode={sheet.mode}
          rule={sheet.mode === 'view' ? sheet.rule : null}
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
      />

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
        objectName={list.toDelete?.propertyKey ?? ''}
      />
    </>
  )
}

'use client'

import { LayoutGrid, List } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import {
  DEFAULT_TABLE_PAGE_SIZE_OPTIONS,
  ENABLED_OBJECT_VIEW_TYPES,
  ENABLED_PROCESS_VIEW_TYPES,
} from '@/constants'
import { usePreference } from '@/hooks/ui/use-preference'
import { SegmentedControl } from './segmented-control'

function Row({
  label,
  testId,
  children,
}: {
  label: string
  testId: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-4"
      data-testid={testId}
    >
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  )
}

export function PreferencesSettings() {
  const t = useTranslations('settings.preferences')
  const tOpt = useTranslations('settings.preferences.options')
  const [objectsView, setObjectsView] = usePreference('objectsView')
  const [processView, setProcessView] = usePreference('processView')
  const [propertiesView, setPropertiesView] = usePreference('propertiesView')
  const [pageSize, setPageSize] = usePreference('pageSize')

  // A preference saved before a view was retired no longer matches any option, and a segmented
  // control with no match renders nothing selected. Fall back for display without overwriting the
  // stored value.
  const processViewValue = ENABLED_PROCESS_VIEW_TYPES.some(
    (v) => v.value === processView
  )
    ? processView
    : ENABLED_PROCESS_VIEW_TYPES[0].value

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label={t('objects')} testId="pref-objects">
          <SegmentedControl
            ariaLabel={t('objects')}
            value={objectsView}
            onChange={setObjectsView}
            testIdPrefix="pref-objects"
            options={ENABLED_OBJECT_VIEW_TYPES.map((v) => ({
              value: v.value,
              label: tOpt(v.value),
              icon: v.icon,
            }))}
          />
        </Row>
        <Row label={t('processes')} testId="pref-processes">
          <SegmentedControl
            ariaLabel={t('processes')}
            value={processViewValue}
            onChange={setProcessView}
            testIdPrefix="pref-processes"
            options={ENABLED_PROCESS_VIEW_TYPES.map((v) => ({
              value: v.value,
              label: tOpt(v.value),
              icon: v.icon,
            }))}
          />
        </Row>
        <Row label={t('properties')} testId="pref-properties">
          <SegmentedControl
            ariaLabel={t('properties')}
            value={propertiesView}
            onChange={setPropertiesView}
            testIdPrefix="pref-properties"
            options={[
              { value: 'detailed', label: tOpt('detailed'), icon: List },
              { value: 'grid', label: tOpt('grid'), icon: LayoutGrid },
            ]}
          />
        </Row>
        <Row label={t('rowsPerPage')} testId="pref-page-size">
          <SegmentedControl
            ariaLabel={t('rowsPerPage')}
            value={String(pageSize)}
            onChange={(value) => setPageSize(Number(value))}
            testIdPrefix="pref-page-size"
            options={DEFAULT_TABLE_PAGE_SIZE_OPTIONS.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
          />
        </Row>
      </CardContent>
    </Card>
  )
}

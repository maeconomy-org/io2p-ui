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
  ENABLED_OBJECT_VIEW_TYPES,
  ENABLED_PROCESS_VIEW_TYPES,
} from '@/constants'
import { usePreference } from '@/hooks'
import { useAppConfig } from '@/contexts'
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
  const [filesView, setFilesView] = usePreference('filesView')

  // Hide the Dashboard option (and coerce a stale saved preference) when the
  // processes dashboard is disabled via PROCESS_DASHBOARD_ENABLED.
  const dashboardEnabled = useAppConfig().processDashboardEnabled === 'true'
  const processViewTypes = dashboardEnabled
    ? ENABLED_PROCESS_VIEW_TYPES
    : ENABLED_PROCESS_VIEW_TYPES.filter((v) => v.value !== 'dashboard')
  const processViewValue =
    processView === 'dashboard' && !dashboardEnabled ? 'sankey' : processView

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
            options={processViewTypes.map((v) => ({
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
        <Row label={t('files')} testId="pref-files">
          <SegmentedControl
            ariaLabel={t('files')}
            value={filesView}
            onChange={setFilesView}
            testIdPrefix="pref-files"
            options={[
              { value: 'list', label: tOpt('list'), icon: List },
              { value: 'grid', label: tOpt('grid'), icon: LayoutGrid },
            ]}
          />
        </Row>
      </CardContent>
    </Card>
  )
}

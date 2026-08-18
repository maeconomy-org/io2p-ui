'use client'

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
import { ENTITY_SCOPES } from '@/constants/preferences'
import { usePreference } from '@/hooks/ui/use-preference'
import { PreferenceSelect } from './preference-select'

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
          <PreferenceSelect
            ariaLabel={t('objects')}
            value={objectsView}
            onChange={setObjectsView}
            testId="pref-objects"
            options={ENABLED_OBJECT_VIEW_TYPES.map((v) => ({
              value: v.value,
              label: tOpt(v.value),
            }))}
          />
        </Row>
        <Row label={t('processes')} testId="pref-processes">
          <PreferenceSelect
            ariaLabel={t('processes')}
            value={processViewValue}
            onChange={setProcessView}
            testId="pref-processes"
            options={ENABLED_PROCESS_VIEW_TYPES.map((v) => ({
              value: v.value,
              label: tOpt(v.value),
            }))}
          />
        </Row>
        <Row label={t('properties')} testId="pref-properties">
          <PreferenceSelect
            ariaLabel={t('properties')}
            value={propertiesView}
            onChange={setPropertiesView}
            testId="pref-properties"
            options={[
              { value: 'detailed', label: tOpt('detailed') },
              { value: 'grid', label: tOpt('grid') },
            ]}
          />
        </Row>
        <ScopeRow preference="objectsScope" label={t('objectsAccess')} />
        <ScopeRow preference="processScope" label={t('processesAccess')} />
        <ScopeRow preference="formulaScope" label={t('formulasAccess')} />
        <ScopeRow preference="constantScope" label={t('constantsAccess')} />
        <ScopeRow preference="templateScope" label={t('templatesAccess')} />
        <Row label={t('rowsPerPage')} testId="pref-page-size">
          <PreferenceSelect
            ariaLabel={t('rowsPerPage')}
            value={String(pageSize)}
            onChange={(value) => setPageSize(Number(value))}
            testId="pref-page-size"
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

const SCOPE_LABEL: Record<(typeof ENTITY_SCOPES)[number], string> = {
  all: 'scopeAll',
  mine: 'scopeMine',
  shared: 'scopeShared',
  public: 'scopePublic',
}

/**
 * Which access slice one list opens on.
 *
 * Five of these rather than one global switch: someone may want only their own objects while still
 * needing the whole formula library, which is shared by construction.
 */
function ScopeRow({
  preference,
  label,
}: {
  preference:
    | 'objectsScope'
    | 'processScope'
    | 'formulaScope'
    | 'constantScope'
    | 'templateScope'
  label: string
}) {
  const tCommon = useTranslations('common')
  const [scope, setScope] = usePreference(preference)
  const testId = `pref-${preference}`

  return (
    <Row label={label} testId={testId}>
      <PreferenceSelect
        ariaLabel={label}
        value={scope}
        onChange={setScope}
        testId={testId}
        options={ENTITY_SCOPES.map((value) => ({
          value,
          label: tCommon(SCOPE_LABEL[value]),
        }))}
      />
    </Row>
  )
}

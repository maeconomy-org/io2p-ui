import { getTranslations } from 'next-intl/server'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  AccountDetails,
  AppearanceSettings,
  PreferencesSettings,
  SecuritySettings,
} from './components'

const TAB_TRIGGER =
  'w-full justify-start rounded-md px-3 py-2 text-sm font-medium data-[state=active]:bg-muted data-[state=active]:shadow-none'

/**
 * Server Component. It was 'use client' only to reach `useTranslations`, which
 * meant the whole tab shell — headings, labels, static markup — shipped as
 * client JS and rendered twice. The interactive parts (Tabs, and the four
 * settings panels) are client components in their own right and stay that way;
 * a Server Component renders them perfectly well.
 */
export default async function SettingsPage() {
  const t = await getTranslations('settings')

  return (
    <div className="container mx-auto px-4 py-8" data-testid="settings-page">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          {t('description')}
        </p>

        <Tabs
          defaultValue="account"
          orientation="vertical"
          className="flex flex-col gap-6 md:flex-row md:gap-8"
        >
          <TabsList className="h-auto shrink-0 flex-row justify-start gap-1 overflow-x-auto bg-transparent p-0 md:w-52 md:flex-col md:items-stretch md:overflow-visible">
            <TabsTrigger
              value="account"
              data-testid="settings-tab-account"
              className={TAB_TRIGGER}
            >
              {t('tabs.account')}
            </TabsTrigger>
            <TabsTrigger
              value="security"
              data-testid="settings-tab-security"
              className={TAB_TRIGGER}
            >
              {t('tabs.security')}
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              data-testid="settings-tab-appearance"
              className={TAB_TRIGGER}
            >
              {t('tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              data-testid="settings-tab-preferences"
              className={TAB_TRIGGER}
            >
              {t('tabs.preferences')}
            </TabsTrigger>
          </TabsList>

          <div className="min-w-0 flex-1">
            <TabsContent value="account" className="mt-0">
              <AccountDetails />
            </TabsContent>
            <TabsContent value="security" className="mt-0">
              <SecuritySettings />
            </TabsContent>
            <TabsContent value="appearance" className="mt-0">
              <AppearanceSettings />
            </TabsContent>
            <TabsContent value="preferences" className="mt-0">
              <PreferencesSettings />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}

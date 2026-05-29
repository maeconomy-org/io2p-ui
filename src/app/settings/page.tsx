'use client'

import { useTranslations } from 'next-intl'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  AccountDetails,
  AppearanceSettings,
  PreferencesSettings,
} from './components'

export default function SettingsPage() {
  const t = useTranslations('settings')

  return (
    <div className="container mx-auto px-4 py-8" data-testid="settings-page">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mb-8 mt-1 text-muted-foreground">{t('description')}</p>

        <Tabs defaultValue="account">
          <TabsList>
            <TabsTrigger value="account" data-testid="settings-tab-account">
              {t('tabs.account')}
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              data-testid="settings-tab-appearance"
            >
              {t('tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              data-testid="settings-tab-preferences"
            >
              {t('tabs.preferences')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-6">
            <AccountDetails />
          </TabsContent>
          <TabsContent value="appearance" className="mt-6">
            <AppearanceSettings />
          </TabsContent>
          <TabsContent value="preferences" className="mt-6">
            <PreferencesSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

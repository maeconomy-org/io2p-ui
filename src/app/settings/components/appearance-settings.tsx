'use client'

import { useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Moon, Sun } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { useTheme } from '@/hooks/use-theme'
import { useSetLocale } from '@/hooks/ui/use-set-locale'
import { LOCALES, type LocaleValue } from '@/components/language-switcher'
import { SegmentedControl } from './segmented-control'

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function AppearanceSettings() {
  const t = useTranslations('settings.appearance')
  const tTheme = useTranslations('theme')
  const { theme, resolvedTheme, setTheme } = useTheme()
  const locale = useLocale() as LocaleValue
  const setLocale = useSetLocale()

  // `theme` can be 'system'; fall back to the resolved value so a segment is
  // always active.
  const themeValue: 'light' | 'dark' =
    theme === 'light' || theme === 'dark'
      ? theme
      : resolvedTheme === 'dark'
        ? 'dark'
        : 'light'

  const changeLocale = useCallback(
    (next: LocaleValue) => setLocale(next),
    [setLocale]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <Row label={t('theme')}>
          <SegmentedControl
            ariaLabel={t('theme')}
            value={themeValue}
            onChange={setTheme}
            testIdPrefix="appearance-theme"
            options={[
              { value: 'light', label: tTheme('light'), icon: Sun },
              { value: 'dark', label: tTheme('dark'), icon: Moon },
            ]}
          />
        </Row>
        <Row label={t('language')} hint={t('languageReloadHint')}>
          <SegmentedControl
            ariaLabel={t('language')}
            value={locale}
            onChange={changeLocale}
            testIdPrefix="appearance-language"
            options={LOCALES.map((l) => ({
              value: l.value,
              label: l.label,
              shortLabel: l.value.toUpperCase(),
            }))}
          />
        </Row>
      </CardContent>
    </Card>
  )
}

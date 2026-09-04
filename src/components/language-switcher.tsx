'use client'

import { useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Check, Languages } from 'lucide-react'

import { useSetLocale } from '@/hooks/ui/use-set-locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Button,
} from '@/components/ui'

export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
] as const

export type LocaleValue = (typeof LOCALES)[number]['value']

export function LanguageSelect({ className }: { className?: string }) {
  const t = useTranslations()
  const locale = useLocale() as LocaleValue
  const setLocale = useSetLocale()

  const handleChange = useCallback(
    (value: string) => setLocale(value as LocaleValue),
    [setLocale]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          // The aria-label is TRANSLATED, so a locator built on it stops
          // matching the moment the page is in Dutch — which is the state half
          // the language cases put it in.
          data-testid="language-select"
          aria-label={t('footer.language')}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onClick={() => handleChange(item.value)}
            className="flex items-center cursor-pointer justify-between"
          >
            <span>{item.label}</span>
            {locale === item.value && <Check className="h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function LanguageDropdownItem() {
  const t = useTranslations()
  const locale = useLocale() as LocaleValue
  const setLocale = useSetLocale()

  const handleChange = useCallback(
    (value: string) => setLocale(value as LocaleValue),
    [setLocale]
  )

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer">
        <Languages className="h-4 w-4 mr-2" />
        {t('footer.language')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleChange}>
          {LOCALES.map((item) => (
            <DropdownMenuRadioItem
              key={item.value}
              value={item.value}
              className="cursor-pointer"
            >
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

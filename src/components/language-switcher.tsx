'use client'

import { useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Check, Languages } from 'lucide-react'

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

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Nederlands' },
] as const

type LocaleValue = (typeof LOCALES)[number]['value']

function setLocaleCookie(locale: LocaleValue) {
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}`
}

export function LanguageSelect({ className }: { className?: string }) {
  const t = useTranslations()
  const locale = useLocale() as LocaleValue

  const handleChange = useCallback((value: string) => {
    setLocaleCookie(value as LocaleValue)
    window.location.reload()
  }, [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
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
            className="flex items-center justify-between"
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

  const handleChange = useCallback((value: string) => {
    setLocaleCookie(value as LocaleValue)
    window.location.reload()
  }, [])

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Languages className="h-4 w-4" />
        {t('footer.language')}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleChange}>
          {LOCALES.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <span className="flex items-center gap-2 justify-between w-full">
                {item.label}
                {locale === item.value && <Check className="h-3 w-3" />}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

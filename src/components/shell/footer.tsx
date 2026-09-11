'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { useAppConfig } from '@/contexts'
import { FOOTER_LINKS } from '@/constants'
import { ThemeSelect } from '@/components/ui'
import { LanguageSelect } from '@/components/language-switcher'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const t = useTranslations()
  const config = useAppConfig()

  return (
    <footer className="w-full mt-6">
      <div className="border-t py-4 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <p>
              &copy; {currentYear} {config.appName}. {t('footer.rights')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.path}
                href={link.path}
                className="hover:text-foreground transition-colors"
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
            <div className="flex items-center gap-1">
              <LanguageSelect className="size-10" />
              <ThemeSelect className="size-10" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

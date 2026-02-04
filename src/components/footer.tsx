import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { APP_NAME, FOOTER_LINKS } from '@/constants'
import { LanguageSelect } from '@/components/language-switcher'

export default function Footer() {
  const currentYear = new Date().getFullYear()
  const t = useTranslations()

  return (
    <footer className="w-full mt-6">
      {/* Main Footer */}
      <div className="border-t py-4 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>
            <p>
              {currentYear} {APP_NAME}. {t('footer.rights')}
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
            <div className="flex items-center gap-2">
              <LanguageSelect className="size-10" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import { Building2, HelpCircle, Shield } from 'lucide-react'
import Link from 'next/link'

import { useAppConfig } from '@/contexts'
import { ThemeSelect } from '@/components/ui'
import { LanguageSelect } from '@/components/language-switcher'
import { AuthCarousel, AuthPattern } from './components'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations()
  const config = useAppConfig()

  return (
    <div className="relative flex flex-1">
      <div
        data-testid="auth-chrome"
        className="absolute right-4 top-4 z-20 flex items-center gap-1"
      >
        <LanguageSelect className="size-9" />
        <ThemeSelect className="size-9" />
      </div>

      {/* Left Column - Info Panel */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="relative w-full rounded-3xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-slate-800 to-slate-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_center,_var(--tw-gradient-stops))] from-rose-500/30 via-blue-500/20 to-transparent" />

          <AuthPattern />

          {/* Content - centered x/y */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-12 xl:px-16 py-12 text-white">
            <div className="max-w-md w-full space-y-10 text-center">
              {/* Tagline */}
              <div>
                <div className="flex items-center justify-center gap-2.5 mb-6">
                  <Building2 className="h-8 w-8 text-white/90" />
                  <span className="font-bold text-2xl text-white/90">
                    {config.appAcronym}
                  </span>
                </div>
                <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-3">
                  {config.appName}
                </h2>
                <p className="text-base text-white/70 leading-relaxed">
                  {t('auth.tagline')}
                </p>
              </div>

              <AuthCarousel />
            </div>
          </div>
        </div>
      </div>

      {/* Right Column - Auth Content */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 px-6 sm:px-12 lg:px-16 xl:px-24 py-12">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Logo & Title (visible on mobile, hidden on desktop since it's on the left) */}
          <div className="text-center">
            <div className="flex items-center justify-center lg:justify-start gap-2.5 mb-6 lg:hidden">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="font-bold text-2xl">{config.appAcronym}</span>
            </div>
            {children}
          </div>

          {/* Footer links */}
          <div className="flex items-center justify-between text-sm">
            <Link
              href="/help"
              className="text-primary hover:text-primary/80 flex items-center transition-colors"
            >
              <HelpCircle className="h-4 w-4 mr-1" />
              {t('auth.needHelp')}
            </Link>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              {t('auth.mtls')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

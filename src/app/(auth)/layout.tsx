'use client'

import { useTranslations } from 'next-intl'
import { Building2, HelpCircle, Shield } from 'lucide-react'
import Link from 'next/link'

import { AUTH_FEATURES, AUTH_STEPS } from '@/constants'
import { useAppConfig } from '@/contexts'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations()
  const config = useAppConfig()

  return (
    <div className="flex flex-1">
      {/* Left Column - Info Panel */}
      <div className="hidden lg:flex lg:w-1/2 p-6">
        <div className="relative w-full rounded-3xl overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-slate-800 to-slate-700" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_center,_var(--tw-gradient-stops))] from-rose-500/30 via-blue-500/20 to-transparent" />

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

              {/* How it works */}
              <div className="space-y-3 text-left">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40 text-center">
                  {t('auth.infoTitle')}
                </h3>
                <div className="space-y-3">
                  {AUTH_STEPS.map((step) => (
                    <div
                      key={step.num}
                      className="flex items-start gap-3 bg-white/5 backdrop-blur-sm rounded-xl p-3.5 border border-white/10"
                    >
                      <div className="size-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                        <step.icon className="h-4 w-4 text-white/80" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-white/90">
                          {t(`auth.${step.titleKey}`)}
                        </p>
                        <p className="text-sm text-white/50 mt-0.5">
                          {t(`auth.${step.descKey}`)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {AUTH_FEATURES.map((feat) => (
                  <div
                    key={feat.key}
                    className="flex items-center gap-2 bg-white/5 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/10"
                  >
                    <feat.icon className="h-4 w-4 shrink-0 text-white/70" />
                    <span className="text-sm font-medium text-white/80">
                      {t(`auth.${feat.key}`)}
                    </span>
                  </div>
                ))}
              </div>
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

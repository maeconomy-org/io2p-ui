'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { AUTH_SCENES } from '@/constants'

const ROTATION_MS = 6000
const TAG_INDEXES = [1, 2, 3] as const

// `useSyncExternalStore`, not an effect: matchMedia IS an external store, and reading it into state
// meant the first paint always animated before correcting itself a render later.
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function AuthCarousel() {
  const t = useTranslations()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  )

  useEffect(() => {
    if (paused || reducedMotion) return
    const id = window.setInterval(() => {
      setActive((cur) => (cur + 1) % AUTH_SCENES.length)
    }, ROTATION_MS)
    return () => window.clearInterval(id)
  }, [paused, reducedMotion])

  return (
    <div
      className="space-y-7"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="auth-carousel"
    >
      <div className="relative h-80">
        {AUTH_SCENES.map((scene, i) => {
          const Icon = scene.icon
          const isActive = i === active
          return (
            <div
              key={scene.id}
              role="group"
              aria-hidden={!isActive}
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-start gap-5 text-center transition-all duration-500',
                isActive
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none translate-y-2 opacity-0'
              )}
            >
              <div
                className={cn(
                  'relative flex size-20 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br backdrop-blur-sm',
                  scene.accent
                )}
              >
                <Icon className="h-9 w-9 text-white" strokeWidth={1.75} />
                <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
              </div>

              <div className="space-y-2">
                <p className="text-2xl font-semibold leading-tight text-white">
                  {t(`auth.scenes.${scene.id}.title`)}
                </p>
                <p className="mx-auto max-w-md text-base leading-relaxed text-white/70">
                  {t(`auth.scenes.${scene.id}.description`)}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {scene.secondaryIcons.map((TagIcon, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm"
                  >
                    <TagIcon className="h-3.5 w-3.5" />
                    {t(`auth.scenes.${scene.id}.tag${TAG_INDEXES[idx]}`)}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div
        className="flex items-center justify-center gap-2"
        role="tablist"
        aria-label={t('auth.carousel.indicators')}
      >
        {AUTH_SCENES.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={t('auth.carousel.goToSlide', { n: i + 1 })}
            onClick={() => setActive(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === active
                ? 'w-8 bg-white'
                : 'w-2 bg-white/30 hover:bg-white/50'
            )}
          />
        ))}
      </div>
    </div>
  )
}

export default AuthCarousel

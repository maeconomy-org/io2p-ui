'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Shield, AlertTriangle, Loader2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { logger } from '@/lib/observability/logger'
import { cn } from '@/lib/utils'
import { useAuth, useAppConfig } from '@/contexts'
import {
  SOCIAL_PROVIDERS,
  enabledSocialProviders,
  type SocialProviderId,
} from '@/constants'
import { loginSchema, type LoginFormData } from '@/lib/auth/schemas'
import {
  Badge,
  Button,
  Card,
  Input,
  Separator,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  PasswordInput,
} from '@/components/ui'

/** Remembers which sign-in the user reached for last, so that path is highlighted next time. */
const LAST_AUTH_METHOD_KEY = 'iom-last-auth-method'

type AuthMethod = 'certificate' | 'email' | SocialProviderId

const AUTH_METHODS = new Set<AuthMethod>([
  'certificate',
  'email',
  ...SOCIAL_PROVIDERS.map((p) => p.id),
])

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations()
  const {
    isAuthenticated,
    authLoading,
    handleAuth,
    handleEmailLogin,
    handleSocialLogin,
  } = useAuth()
  const config = useAppConfig()
  const [submitting, setSubmitting] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProviderId | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  // localStorage IS an external store, so read it as one. As state seeded by an effect it could
  // only ever be null on the first paint, so the "last used" hint flickered in a render late.
  // `subscribe` is a no-op: nothing rewrites the key while this page is mounted.
  const lastAuthMethod = useSyncExternalStore(
    () => () => {},
    () => {
      const stored = localStorage.getItem(LAST_AUTH_METHOD_KEY)
      return stored && AUTH_METHODS.has(stored as AuthMethod)
        ? (stored as AuthMethod)
        : null
    },
    () => null
  )

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onChange',
  })

  const socialProviders = enabledSocialProviders(config.socialProviders)
  // Certificate is the primary action only when it is the ONLY one.
  const hasOtherSignIn =
    config.emailLoginEnabled === 'true' || socialProviders.length > 0
  const isLoading = submitting || certLoading || socialLoading !== null

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/objects')
    }
  }, [isAuthenticated, authLoading, router])

  // No auth gate here on purpose. This page used to render a full-page spinner
  // until the session resolved, so EVERY visitor waited a round trip to be told
  // what they came for. The only case it protected was an already-signed-in
  // user landing on `/`, who now sees the form for one tick before the effect
  // above redirects them — a rare, self-correcting flash traded for an instant
  // form in the common case. It also removes a hydration branch: the session
  // resolves only on the client, so gating render on it made the server and the
  // client's first render disagree.

  const mapError = (errorMessage: string): string => {
    if (errorMessage.includes('credentials')) {
      return t('auth.errors.invalidCredentials')
    }
    if (errorMessage.includes('certificate')) {
      return t('auth.errors.certificateFailed')
    }
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection')
    ) {
      return t('auth.errors.networkFailed')
    }
    if (errorMessage.includes('timeout')) {
      return t('auth.errors.timeout')
    }
    if (
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden')
    ) {
      return t('auth.errors.unauthorized')
    }
    if (errorMessage.includes('expired')) {
      return t('auth.errors.expired')
    }
    return t('auth.errors.authFailed')
  }

  const onEmailSubmit = async (data: LoginFormData) => {
    // check if emaillogin is enabled
    if (config.emailLoginEnabled === 'false') {
      setError(t('auth.errors.emailLoginDisabled'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const result = await handleEmailLogin(data.email, data.password)
      if (!result.success) {
        throw new Error(result.error)
      }
      localStorage.setItem(LAST_AUTH_METHOD_KEY, 'email')
      router.replace('/objects')
    } catch (err) {
      logger.error('Email Login Error:', { err })
      const msg =
        err instanceof Error ? err.message : 'Unknown authentication error'
      setError(mapError(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const onSocialClick = async (provider: SocialProviderId) => {
    setSocialLoading(provider)
    setError(null)

    // Written before the redirect, not after: on success this browsing context
    // is gone, so there is no "after" to write it in.
    localStorage.setItem(LAST_AUTH_METHOD_KEY, provider)

    const result = await handleSocialLogin(provider)
    if (!result.success) {
      localStorage.removeItem(LAST_AUTH_METHOD_KEY)
      setError(mapError(result.error ?? ''))
      setSocialLoading(null)
    }
    // No success branch and no `finally`: the provider redirect is already
    // underway, and dropping the overlay here would flash the form back.
  }

  const handleCertificateAuth = async () => {
    setCertLoading(true)
    setError(null)

    try {
      const result = await handleAuth()
      if (!result.success) {
        throw new Error(result.error)
      }
      localStorage.setItem(LAST_AUTH_METHOD_KEY, 'certificate')
      router.replace('/objects')
    } catch (err) {
      logger.error('Certificate Authentication Error:', { err })
      const msg =
        err instanceof Error ? err.message : 'Unknown authentication error'
      setError(mapError(msg))
    } finally {
      setCertLoading(false)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">
        {t('auth.welcome', { acronym: config.appAcronym })}
      </h1>
      <p className="mt-2 text-muted-foreground transition-all duration-300">
        {t('auth.subtitle', {
          name: config.appName,
          description: config.appDescription,
        })}
      </p>

      {/* Auth Card */}
      <Card className="p-6 shadow-lg mt-8 relative overflow-hidden ">
        {/* Loading Overlay */}
        <div
          className={cn(
            'absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm transition-all duration-500 ease-in-out',
            isLoading
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          )}
        >
          <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
            <Loader2
              className="h-10 w-10 animate-spin text-primary motion-reduce:animate-none"
              aria-hidden
            />
            <p className="text-sm font-medium text-muted-foreground">
              {t('auth.loading')}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'space-y-6 transition-all duration-500 ease-in-out',
            isLoading
              ? 'scale-[0.98] opacity-0 blur-sm'
              : 'scale-100 opacity-100'
          )}
        >
          {error && (
            <div
              data-testid="auth-error"
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-in slide-in-from-top-2 duration-300"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {config.emailLoginEnabled === 'true' && (
            <>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onEmailSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="text-left">
                        <FormLabel>{t('auth.email.label')}</FormLabel>
                        {/* The icon wrapper sits OUTSIDE FormControl: it is a Radix Slot, so it
                            puts `id` on its immediate child — with the div inside, the id landed
                            there and FormLabel's `htmlFor` pointed at a div, leaving the input
                            with no label at all. */}
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <FormControl>
                            <Input
                              placeholder={t('auth.email.placeholder')}
                              className="pl-10"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p
                          data-testid="auth-email-error"
                          className="text-red-500 text-sm"
                        >
                          {form.formState.errors.email?.message &&
                            (form.formState.errors.email.message.startsWith(
                              'auth.'
                            )
                              ? t(form.formState.errors.email.message)
                              : form.formState.errors.email.message)}
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="text-left">
                        <div className="flex items-center justify-between">
                          <FormLabel>{t('auth.password.label')}</FormLabel>
                          <Link
                            href="/forgot-password"
                            className="text-sm text-primary transition-colors hover:text-primary/80"
                          >
                            {t('auth.forgotPassword.link')}
                          </Link>
                        </div>
                        <FormControl>
                          <PasswordInput
                            placeholder={t('auth.password.placeholder')}
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <p
                          data-testid="auth-password-error"
                          className="text-red-500 text-sm"
                        >
                          {form.formState.errors.password?.message &&
                            (form.formState.errors.password.message.startsWith(
                              'auth.'
                            )
                              ? t(form.formState.errors.password.message)
                              : form.formState.errors.password.message)}
                        </p>
                      </FormItem>
                    )}
                  />

                  <div className="relative">
                    <Button
                      type="submit"
                      data-testid="auth-email-submit"
                      className="w-full"
                      disabled={isLoading}
                    >
                      {!isLoading && <Mail className="mr-2 h-4 w-4" />}
                      {t('auth.email.signIn')}
                      {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>
                    {lastAuthMethod === 'email' && (
                      <Badge
                        variant="outline"
                        data-testid="auth-last-used-email"
                        className="absolute -top-2.5 -right-3 rounded-md border-primary bg-background text-[10px] px-1.5 py-0.5 font-medium pointer-events-none text-primary"
                      >
                        {t('auth.lastUsed')}
                      </Badge>
                    )}
                  </div>
                </form>
              </Form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('auth.orContinueWith')}
                  </span>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <div className="relative">
              <Button
                type="button"
                onClick={handleCertificateAuth}
                data-testid="auth-certificate"
                variant={hasOtherSignIn ? 'outline' : 'default'}
                className="w-full transition-colors"
                disabled={isLoading}
              >
                {!isLoading && <Shield className="mr-2 h-4 w-4" />}
                {t('auth.certificate.signIn')}
              </Button>
              {lastAuthMethod === 'certificate' && (
                <Badge
                  variant="outline"
                  data-testid="auth-last-used-certificate"
                  className="absolute -top-2.5 -right-3 rounded-md border-primary bg-background text-[10px] px-1.5 py-0.5 font-medium pointer-events-none text-primary"
                >
                  {t('auth.lastUsed')}
                </Badge>
              )}
            </div>

            {socialProviders.map(({ id, Icon, labelKey }) => (
              <div key={id} className="relative">
                <Button
                  type="button"
                  onClick={() => onSocialClick(id)}
                  data-testid={`auth-social-${id}`}
                  variant="outline"
                  className="w-full transition-colors"
                  disabled={isLoading}
                >
                  {!isLoading && <Icon className="mr-2 h-4 w-4" />}
                  {t(`auth.social.${labelKey}`)}
                </Button>
                {lastAuthMethod === id && (
                  <Badge
                    variant="outline"
                    data-testid={`auth-last-used-${id}`}
                    className="absolute -top-2.5 -right-3 rounded-md border-primary bg-background text-[10px] px-1.5 py-0.5 font-medium pointer-events-none text-primary"
                  >
                    {t('auth.lastUsed')}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  )
}

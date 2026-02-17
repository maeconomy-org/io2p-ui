'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Shield, AlertTriangle, Mail, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { logger, cn } from '@/lib'
import { useAuth, useAppConfig } from '@/contexts'
import { loginSchema, type LoginFormData } from '@/lib/validations/auth'
import {
  Button,
  Card,
  Input,
  Separator,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  PasswordInput,
} from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations()
  const { isAuthenticated, authLoading, handleAuth, handleEmailLogin } =
    useAuth()
  const config = useAppConfig()
  const [submitting, setSubmitting] = useState(false)
  const [certLoading, setCertLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onChange',
  })

  const isLoading = submitting || certLoading

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/objects')
    }
  }, [isAuthenticated, authLoading, router])

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

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
      router.replace('/objects')
    } catch (err) {
      logger.error('Email Login Error:', err)
      const msg =
        err instanceof Error ? err.message : 'Unknown authentication error'
      setError(mapError(msg))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCertificateAuth = async () => {
    setCertLoading(true)
    setError(null)

    try {
      const result = await handleAuth()
      console.log(result)
      if (!result.success) {
        throw new Error(result.error)
      }
      router.replace('/objects')
    } catch (err) {
      logger.error('Certificate Authentication Error:', err)
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
      <Card className="p-6 shadow-lg mt-8 relative overflow-hidden min-h-[400px]">
        {/* Loading Overlay */}
        <div
          className={cn(
            'absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm transition-all duration-500 ease-in-out',
            isLoading
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          )}
        >
          <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/0" />
              <Loader2 className="absolute top-0 h-16 w-16 animate-spin text-primary" />
            </div>
            <p className="text-sm font-medium animate-pulse text-muted-foreground">
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
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive animate-in slide-in-from-top-2 duration-300">
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
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('auth.email.placeholder')}
                              className="pl-10"
                              disabled={isLoading}
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <p className="text-red-500 text-sm">
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
                        <FormLabel>{t('auth.password.label')}</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder={t('auth.password.placeholder')}
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-red-500 text-sm">
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

                  <Button
                    type="submit"
                    className="w-full py-6 text-base"
                    disabled={isLoading}
                  >
                    {!isLoading && <Mail className="mr-2 h-5 w-5" />}
                    {t('auth.email.signIn')}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
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

          <Button
            onClick={handleCertificateAuth}
            variant={
              config.emailLoginEnabled === 'true' ? 'outline' : 'default'
            }
            className="w-full py-6 text-base transition-colors"
            disabled={isLoading}
          >
            {!isLoading && <Shield className="mr-2 h-5 w-5" />}
            {t('auth.certificate.signIn')}
          </Button>
        </div>
      </Card>
    </>
  )
}

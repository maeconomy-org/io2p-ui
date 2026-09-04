'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, KeyRound, Loader2, AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { logger } from '@/lib/observability/logger'
import { authClient } from '@/lib/auth/client'
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '@/lib/auth/schemas'
import {
  Button,
  Card,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  PasswordInput,
} from '@/components/ui'

function ResetPasswordForm() {
  const t = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const urlError = searchParams.get('error')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onChange',
  })

  // No token (or the issuer flagged it invalid) → can't reset here.
  const invalidToken = !token || urlError === 'INVALID_TOKEN'

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: data.password,
        token,
      })
      if (resetError) {
        // Surface the issuer's reason (e.g. HIBP breach / policy) verbatim;
        // fall back to the generic copy only if it's empty.
        setError(resetError.message || t('auth.resetPassword.error'))
        return
      }
      toast.success(t('auth.resetPassword.success'))
      router.replace('/')
    } catch (err) {
      logger.error('Reset password error:', { err })
      setError(t('auth.resetPassword.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const passwordError = form.formState.errors.password?.message
  const confirmError = form.formState.errors.confirmPassword?.message

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">
        {t('auth.resetPassword.title')}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t('auth.resetPassword.subtitle')}
      </p>

      <Card className="p-6 shadow-lg mt-8">
        {invalidToken ? (
          <div className="space-y-4 text-center">
            <AlertTriangle
              data-testid="reset-password-invalid-token"
              className="mx-auto h-10 w-10 text-destructive"
            />
            <p className="text-sm text-muted-foreground">
              {t('auth.resetPassword.invalidToken')}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/forgot-password">
                {t('auth.resetPassword.requestNew')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="text-left">
                      <FormLabel>
                        {t('auth.resetPassword.newPassword')}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder={t('auth.password.placeholder')}
                          disabled={submitting}
                          {...field}
                        />
                      </FormControl>
                      {passwordError && (
                        <p className="text-red-500 text-sm">
                          {t(passwordError)}
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="text-left">
                      <FormLabel>
                        {t('auth.resetPassword.confirmPassword')}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder={t(
                            'auth.resetPassword.confirmPlaceholder'
                          )}
                          disabled={submitting}
                          {...field}
                        />
                      </FormControl>
                      {confirmError && (
                        <p
                          data-testid="reset-password-confirm-error"
                          className="text-red-500 text-sm"
                        >
                          {t(confirmError)}
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  data-testid="reset-password-submit"
                  className="w-full py-6 text-base"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <KeyRound className="mr-2 h-5 w-5" />
                  )}
                  {t('auth.resetPassword.submit')}
                </Button>
              </form>
            </Form>

            <Button asChild variant="ghost" className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('auth.backToLogin')}
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}

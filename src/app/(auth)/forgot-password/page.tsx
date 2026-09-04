'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Mail,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { logger } from '@/lib/observability/logger'
import { authClient } from '@/lib/auth/client'
import {
  forgotPasswordSchema,
  type ForgotPasswordFormData,
} from '@/lib/auth/schemas'
import {
  Button,
  Card,
  Input,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
} from '@/components/ui'

export default function ForgotPasswordPage() {
  const t = useTranslations()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onChange',
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setSubmitting(true)
    setError(null)
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: reqError } = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo,
      })
      if (reqError) {
        throw new Error(reqError.message)
      }
      // Always show success (don't reveal whether the email exists).
      setSent(true)
    } catch (err) {
      logger.error('Forgot password error:', { err })
      setError(t('auth.forgotPassword.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const emailError = form.formState.errors.email?.message

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">
        {t('auth.forgotPassword.title')}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t('auth.forgotPassword.description')}
      </p>

      <Card className="p-6 shadow-lg mt-8">
        {sent ? (
          <div
            data-testid="forgot-password-sent"
            className="space-y-4 text-center"
          >
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('auth.forgotPassword.success')}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">{t('auth.backToLogin')}</Link>
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
                  name="email"
                  render={({ field }) => (
                    <FormItem className="text-left">
                      <FormLabel>{t('auth.email.label')}</FormLabel>
                      {/* Wrapper outside FormControl — it is a Radix Slot and puts `id` on its
                          immediate child, so a div here leaves the input unlabelled. */}
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            placeholder={t('auth.email.placeholder')}
                            className="pl-10"
                            disabled={submitting}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      {emailError && (
                        <p
                          data-testid="forgot-password-email-error"
                          className="text-red-500 text-sm"
                        >
                          {t(emailError)}
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  data-testid="forgot-password-submit"
                  className="w-full py-6 text-base"
                  disabled={submitting}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  )}
                  {t('auth.forgotPassword.sendReset')}
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

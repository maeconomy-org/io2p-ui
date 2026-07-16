'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, Loader2, Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { twoFactorSchema, type TwoFactorFormData } from '@/lib/validations/auth'
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

/**
 * Two-factor / one-time code screen. UI ONLY for now — the issuer's 2FA plugin
 * is not enabled yet, so submitting just informs the user. The 6-digit input
 * fits both authenticator-app and email OTP; wire authClient.twoFactor.* once
 * the issuer enables it.
 */
export default function TwoFactorPage() {
  const t = useTranslations()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
    mode: 'onChange',
  })

  const onSubmit = async (_data: TwoFactorFormData) => {
    setSubmitting(true)
    toast.info(t('auth.twoFactor.notEnabled'))
    setSubmitting(false)
  }

  const codeError = form.formState.errors.code?.message

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">
        {t('auth.twoFactor.title')}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {t('auth.twoFactor.subtitle')}
      </p>

      <Card className="p-6 shadow-lg mt-8">
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('auth.twoFactor.comingSoon')}</span>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel>{t('auth.twoFactor.codeLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="numeric"
                        maxLength={6}
                        placeholder={t('auth.twoFactor.codePlaceholder')}
                        className="text-center text-lg tracking-[0.5em]"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    {codeError && (
                      <p className="text-red-500 text-sm">{t(codeError)}</p>
                    )}
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full py-6 text-base"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-5 w-5" />
                )}
                {t('auth.twoFactor.verify')}
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
      </Card>
    </>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import { logger } from '@/lib/observability/logger'
import { authClient } from '@/lib/auth/client'
import {
  changePasswordSchema,
  type ChangePasswordFormData,
} from '@/lib/auth/schemas'
import {
  Card,
  CardContent,
  Button,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  PasswordInput,
} from '@/components/ui'

export function ChangePasswordCard() {
  const t = useTranslations('settings.security')
  const tRoot = useTranslations()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
    mode: 'onChange',
  })

  const onSubmit = async (data: ChangePasswordFormData) => {
    setSubmitting(true)
    try {
      const { error } = await authClient.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        revokeOtherSessions: true,
      })
      if (error) {
        // Surface the issuer's reason (wrong current password, HIBP breach,
        // policy) verbatim; generic fallback only if empty.
        toast.error(error.message || t('password.error'))
        return
      }
      toast.success(t('password.success'))
      form.reset()
    } catch (err) {
      logger.error('Change password error:', { err })
      toast.error(t('password.error'))
    } finally {
      setSubmitting(false)
    }
  }

  const currentError = form.formState.errors.currentPassword?.message
  const newError = form.formState.errors.newPassword?.message

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6 md:flex-row md:gap-8">
        <div className="md:w-1/3">
          <h3 className="text-sm font-medium">{t('password.title')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('password.description')}
          </p>
        </div>
        <div className="flex-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.current')}</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="current-password"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    {currentError && (
                      <p className="text-red-500 text-sm">
                        {tRoot(currentError)}
                      </p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('password.new')}</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        disabled={submitting}
                        {...field}
                      />
                    </FormControl>
                    {newError && (
                      <p className="text-red-500 text-sm">{tRoot(newError)}</p>
                    )}
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {t('password.save')}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  )
}

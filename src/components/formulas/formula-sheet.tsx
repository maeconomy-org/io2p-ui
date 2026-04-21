'use client'

import { useEffect, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import jsep from 'jsep'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { UUMathFormulaDTO } from 'iom-sdk'

import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
  Button,
} from '@/components/ui'
import { formulaSchema, type FormulaFormValues, logger } from '@/lib'
import { useMathFormulas } from '@/hooks'
import { useUuid } from '@/hooks/api/use-uuid'

interface FormulaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formula?: UUMathFormulaDTO | null
  isEditing?: boolean
}

export function FormulaSheet({
  open,
  onOpenChange,
  formula = null,
  isEditing = false,
}: FormulaSheetProps) {
  const t = useTranslations()
  const { useCreateFormula } = useMathFormulas()
  const { useGenerateUuid } = useUuid()
  const createFormulaMutation = useCreateFormula()
  const generateUuidMutation = useGenerateUuid()

  const form = useForm<FormulaFormValues>({
    resolver: zodResolver(formulaSchema),
    defaultValues: {
      name: '',
      expression: '',
      description: '',
      version: '',
    },
  })

  useEffect(() => {
    if (formula && isEditing) {
      form.reset({
        name: formula.name,
        expression: formula.expression,
        description: formula.description || '',
        version: formula.version || '',
      })
    } else {
      form.reset({
        name: '',
        expression: '',
        description: '',
        version: '',
      })
    }
  }, [formula, isEditing, form])

  const onSubmit = async (values: FormulaFormValues) => {
    try {
      const uuid =
        isEditing && formula
          ? formula.uuid
          : await generateUuidMutation.mutateAsync()

      await createFormulaMutation.mutateAsync({
        uuid,
        name: values.name,
        expression: values.expression,
        description: values.description,
        version: values.version,
      })

      toast.success(isEditing ? t('formulas.updated') : t('formulas.created'))
      onOpenChange(false)
      form.reset()
    } catch (error) {
      logger.error('Error saving formula:', error)
      toast.error(t('formulas.saveFailed'))
    }
  }

  const isPending = createFormulaMutation.isPending

  const expressionValue = form.watch('expression')
  const syntaxCheck = useMemo(() => {
    if (!expressionValue?.trim()) return null
    try {
      jsep(expressionValue)
      return { valid: true, error: null }
    } catch (e: any) {
      return { valid: false, error: e.message || 'Invalid syntax' }
    }
  }, [expressionValue])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? t('formulas.editTitle') : t('formulas.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t('formulas.editDescription')
              : t('formulas.createDescription')}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden px-1 -mx-1"
          >
            <div className="flex-1 overflow-y-auto space-y-6 py-6 px-1 -mx-1">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('formulas.name')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('formulas.placeholders.name')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expression"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('formulas.expression')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('formulas.placeholders.expression')}
                          className={cn(
                            'font-mono',
                            syntaxCheck &&
                              !syntaxCheck.valid &&
                              'border-destructive focus-visible:ring-destructive',
                            syntaxCheck &&
                              syntaxCheck.valid &&
                              'border-green-500 focus-visible:ring-green-500'
                          )}
                          {...field}
                        />
                      </FormControl>
                      {syntaxCheck && !syntaxCheck.valid && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {syntaxCheck.error}
                        </p>
                      )}
                      {syntaxCheck && syntaxCheck.valid && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('formulas.validSyntax')}
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('formulas.version')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('formulas.placeholders.version')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('formulas.description')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={t('formulas.placeholders.description')}
                          className="min-h-24"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <SheetFooter className="flex gap-2 border-t pt-4 mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full"
                disabled={isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <>
                    <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    {isEditing
                      ? t('formulas.updating')
                      : t('formulas.creating')}
                  </>
                ) : isEditing ? (
                  t('formulas.update')
                ) : (
                  t('formulas.create')
                )}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

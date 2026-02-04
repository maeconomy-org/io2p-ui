'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Globe, Lock, Save, X, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  Button,
  Input,
  Textarea,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui'
import { logger } from '@/lib'
import { groupSchema, GroupFormValues } from '@/lib/validations'

interface Group {
  uuid: string
  name: string
  description?: string
  type: 'public' | 'private'
  permissions: {
    level: 'read' | 'write' // write includes read access
  }
  objectCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
  objects: string[]
  isDeleted?: boolean
}

interface GroupCreateEditSheetProps {
  group: Group | null // null for create, Group for edit
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormData = GroupFormValues

export function GroupCreateEditSheet({
  group,
  open,
  onOpenChange,
}: GroupCreateEditSheetProps) {
  const t = useTranslations()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEditing = !!group

  const form = useForm<FormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'public',
      permissions: {
        level: 'read',
      },
    },
  })

  // Reset form when group changes or sheet opens/closes
  useEffect(() => {
    if (open) {
      if (group) {
        // Editing existing group
        form.reset({
          name: group.name,
          description: group.description || '',
          type: group.type,
          permissions: group.permissions,
        })
      } else {
        // Creating new group
        form.reset({
          name: '',
          description: '',
          type: 'public',
          permissions: {
            level: 'read',
          },
        })
      }
    }
  }, [group, open, form])

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      logger.info(isEditing ? 'Updating group:' : 'Creating group:', data)

      // Close sheet on success
      onOpenChange(false)

      // Reset form
      form.reset()
    } catch (error) {
      logger.error('Error saving group:', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {isEditing
              ? t('groups.form.editTitle')
              : t('groups.form.createTitle')}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Group Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('groups.form.name')} *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('groups.form.namePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('groups.form.description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('groups.form.descriptionPlaceholder')}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('groups.form.descriptionHint')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Group Type */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t('groups.form.type')} *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="space-y-3"
                    >
                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem
                          value="public"
                          id="public"
                          className="mt-1"
                        />
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor="public"
                            className="flex items-center gap-2 font-medium"
                          >
                            <Globe className="h-4 w-4 text-green-600" />
                            {t('groups.form.publicGroup')}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {t('groups.form.publicDescription')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem
                          value="private"
                          id="private"
                          className="mt-1"
                        />
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor="private"
                            className="flex items-center gap-2 font-medium"
                          >
                            <Lock className="h-4 w-4 text-blue-600" />
                            {t('groups.form.privateGroup')}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {t('groups.form.privateDescription')}
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Default Permissions */}
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t('groups.form.permissions')}
                  </FormLabel>
                  <FormDescription>
                    {t('groups.form.permissionsHint')}
                  </FormDescription>
                  <FormControl>
                    <div className="flex items-center space-x-1 bg-muted rounded-lg p-1">
                      <Button
                        type="button"
                        variant={
                          field.value?.level === 'read' ? 'default' : 'ghost'
                        }
                        size="sm"
                        onClick={() => field.onChange({ level: 'read' })}
                        className="flex-1"
                      >
                        {t('groups.form.readOnly')}
                      </Button>
                      <Button
                        type="button"
                        variant={
                          field.value?.level === 'write' ? 'default' : 'ghost'
                        }
                        size="sm"
                        onClick={() => field.onChange({ level: 'write' })}
                        className="flex-1"
                      >
                        {t('groups.form.writeAccess')}
                      </Button>
                    </div>
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.level === 'write'
                      ? t('groups.form.writeAccessHint')
                      : t('groups.form.readOnlyHint')}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting
                  ? isEditing
                    ? t('groups.form.updating')
                    : t('groups.form.creating')
                  : isEditing
                    ? t('groups.form.updateGroup')
                    : t('groups.form.createGroup')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

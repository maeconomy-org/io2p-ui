'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Globe, Lock, Save, X, Shield } from 'lucide-react'

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
            {isEditing ? 'Edit Group' : 'Create New Group'}
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
                  <FormLabel>Group Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter group name..." {...field} />
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
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the purpose of this group..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional description to help others understand this group's
                    purpose
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
                  <FormLabel>Group Type *</FormLabel>
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
                            Public Group
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Anyone can view this group and its objects. Great
                            for shared resources and public datasets.
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
                            Private Group
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Only users with the group UUID can access this
                            group. Perfect for confidential projects.
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
                    Default Permissions
                  </FormLabel>
                  <FormDescription>
                    Set the default permissions for users who join this group
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
                        Read Only
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
                        Write Access
                      </Button>
                    </div>
                  </FormControl>
                  <div className="text-xs text-muted-foreground">
                    {field.value?.level === 'write'
                      ? 'Users can view, edit, and manage objects in this group'
                      : 'Users can only view objects in this group'}
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
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                    ? 'Update Group'
                    : 'Create Group'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

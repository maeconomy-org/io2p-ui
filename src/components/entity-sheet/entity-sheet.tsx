'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Pencil } from 'lucide-react'
import type { ObjectDTO } from 'io2p-client'

import {
  Button,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'

import { useEntityForm } from './hooks/use-entity-form'
import {
  AddressField,
  MetadataFields,
  ParentsField,
  PropertyFields,
} from './fields'

export interface EntitySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The loaded entity to view/edit; omit (or null) to create. */
  entity?: ObjectDTO | null
  /** Parents to preset on a create draft (the "add child" flow). */
  defaultParentIds?: string[]
}

function DirtyDot({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
  )
}

export function EntitySheet({
  open,
  onOpenChange,
  entity,
  defaultParentIds,
}: EntitySheetProps) {
  const t = useTranslations()
  const isCreate = !entity
  const [editing, setEditing] = useState(isCreate)

  const { form, submit, isSubmitting } = useEntityForm(entity, {
    defaultParentIds,
    onSaved: () => {
      setEditing(false)
      if (isCreate) onOpenChange(false)
    },
  })

  const { dirtyFields, isDirty } = form.formState
  const dirtyCount = Object.keys(dirtyFields).length

  const derivedValueIds = useMemo(() => {
    const s = new Set<string>()
    entity?.properties?.forEach((p) =>
      p.values.forEach((v) => {
        if (v.source === 'derived') s.add(v.id)
      })
    )
    return s
  }, [entity])

  const parentNames = useMemo(() => {
    const m = new Map<string, string>()
    entity?.parents?.forEach((p) => {
      if (p.name) m.set(p.id, p.name)
    })
    return m
  }, [entity])

  const requestClose = () => {
    if (isDirty && !window.confirm(t('objects.detailsSheet.discardConfirm')))
      return
    onOpenChange(false)
  }

  const cancel = () => {
    form.reset()
    if (isCreate) onOpenChange(false)
    else setEditing(false)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            {isCreate ? t('objects.create') : (entity?.name ?? '')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {isCreate ? t('objects.create') : (entity?.name ?? '')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <Tabs
            defaultValue="properties"
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mx-4">
              <TabsTrigger value="properties">
                {t('objects.fields.properties')}
                <DirtyDot show={!!dirtyFields.properties} />
              </TabsTrigger>
              <TabsTrigger value="details">
                {t('objects.detailsSheet.tabDetails')}
                <DirtyDot
                  show={
                    !!(
                      dirtyFields.name ||
                      dirtyFields.description ||
                      dirtyFields.address
                    )
                  }
                />
              </TabsTrigger>
              <TabsTrigger value="parents">
                {t('objects.detailsSheet.tabParents')}
                <DirtyDot show={!!dirtyFields.parentIds} />
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="min-h-0 flex-1 px-4 py-4">
              <TabsContent value="properties" className="mt-0">
                <PropertyFields
                  form={form}
                  editing={editing}
                  derivedValueIds={derivedValueIds}
                />
              </TabsContent>
              <TabsContent value="details" className="mt-0 space-y-6">
                <MetadataFields form={form} editing={editing} />
                <AddressField form={form} editing={editing} />
              </TabsContent>
              <TabsContent value="parents" className="mt-0">
                <ParentsField
                  form={form}
                  editing={editing}
                  parentNames={parentNames}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {isDirty && (
            <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-2 text-sm">
              <span className="font-medium">
                {t('objects.detailsSheet.unsavedChanges', {
                  count: dirtyCount,
                })}
              </span>
            </div>
          )}

          <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-3">
            {!editing ? (
              <Button type="button" onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                {t('common.edit')}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={cancel}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting || !isDirty}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t('common.save')}
                </Button>
              </>
            )}
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { useState } from 'react'
import { useTranslations, useFormatter } from 'next-intl'
import { toast } from 'sonner'
import { AlertCircle, Loader2 } from 'lucide-react'
import type { ConstantDTO } from 'io2p-client'

import {
  Badge,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui'
import { OwnerCell, canWriteLibraryItem } from '@/components/entity-list'
import { useAuth } from '@/contexts'
import { useConstants } from '@/hooks/api/leaves'
import { saveErrorMessage } from '@/lib/io2p-errors'
import { logger } from '@/lib/observability/logger'
import { anchor } from '@/constants'

export type ConstantSheetMode = 'create' | 'edit'

interface ConstantSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ConstantSheetMode
  /** The subject for `edit`. */
  constant?: ConstantDTO | null
}

export function ConstantSheet({
  open,
  onOpenChange,
  mode,
  constant = null,
}: ConstantSheetProps) {
  const t = useTranslations()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b px-6 py-4 pr-12">
          <SheetTitle>
            {mode === 'edit'
              ? (constant?.name ?? t('constants.title'))
              : t('constants.createTitle')}
          </SheetTitle>
          <SheetDescription>
            {mode === 'edit'
              ? t('constants.pinnedNote')
              : t('constants.createDescription')}
          </SheetDescription>
        </SheetHeader>

        {/* Mounts fresh per open, so the fields seed from props at mount rather than being
            re-synced by an effect — opening a second constant cannot show the first one's edits. */}
        {open && (
          <ConstantForm
            mode={mode}
            constant={constant}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function ConstantForm({
  mode,
  constant,
  onDone,
}: {
  mode: ConstantSheetMode
  constant: ConstantDTO | null
  onDone: () => void
}) {
  const t = useTranslations()
  const { userId } = useAuth()
  const { useCreate, useAppendVersion } = useConstants()
  const createMutation = useCreate()
  const appendMutation = useAppendVersion()

  const isEdit = mode === 'edit' && !!constant
  // Built-ins belong to the node, and a constant shared with you is shared read-only — appending a
  // version to either is rejected on write anyway.
  const readOnly = !!constant && !canWriteLibraryItem(constant, userId)

  const current = constant?.versions.at(-1)
  const [name, setName] = useState(constant?.name ?? '')
  const [data, setData] = useState(current?.data ?? '')

  const isPending = createMutation.isPending || appendMutation.isPending
  const changed = isEdit ? data.trim() !== (current?.data ?? '') : true
  const canSave =
    !readOnly &&
    name.trim() !== '' &&
    data.trim() !== '' &&
    changed &&
    !isPending

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    try {
      if (isEdit) {
        // APPEND, never update: earlier versions are immutable, and a calc that pinned one keeps
        // resolving to it. That is the whole point of the type.
        await appendMutation.mutateAsync({
          id: constant.id,
          body: { data: data.trim() },
        })
        toast.success(t('constants.versionAdded'))
      } else {
        await createMutation.mutateAsync({
          body: { name: name.trim(), data: data.trim() },
        })
        toast.success(t('constants.created'))
      }
      onDone()
    } catch (error) {
      logger.error('Save constant failed', { err: error })
      const { key, values } = saveErrorMessage(error)
      toast.error(t(key, values))
    }
  }

  return (
    <form
      onSubmit={submit}
      className="-mx-1 flex min-h-0 flex-1 flex-col overflow-hidden px-1"
    >
      <SheetBody className="space-y-5">
        {readOnly ? (
          // A greyed input offers something the viewer cannot use. `disabled` stays below for
          // the name's IMMUTABILITY, which is a rule about the field and applies to the owner too.
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t('constants.name')}
            </p>
            <p className="text-sm">{name}</p>
          </div>
        ) : (
          <div className="space-y-2" {...anchor('sheetConstantName')}>
            <Label htmlFor="constant-name">{t('constants.name')}</Label>
            <Input
              id="constant-name"
              value={name}
              // The name is what a binding records, so renaming would orphan every calc using it.
              disabled={isEdit}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('constants.placeholders.name')}
            />
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                {t('constants.nameImmutable')}
              </p>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="space-y-2" {...anchor('sheetConstantValue')}>
            <Label htmlFor="constant-data">
              {isEdit ? t('constants.newValue') : t('constants.value')}
            </Label>
            <Input
              id="constant-data"
              value={data}
              onChange={(e) => setData(e.target.value)}
              placeholder={t('constants.placeholders.value')}
            />
            <p className="text-xs text-muted-foreground">
              {t('constants.valueHint')}
            </p>
          </div>
        )}

        {constant && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {t('common.owner')}
            </p>
            <OwnerCell
              system={constant.system}
              ownerUserId={constant.ownerUserId}
              ownerName={constant.ownerName}
            />
          </div>
        )}

        {constant && <VersionHistory constant={constant} />}
      </SheetBody>

      <SheetFooter className="flex-row gap-2 border-t px-6 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onDone}
          disabled={isPending}
        >
          {readOnly ? t('common.close') : t('common.cancel')}
        </Button>
        {!readOnly && (
          <Button
            type="submit"
            className="w-full"
            disabled={!canSave}
            {...anchor('sheetSubmit')}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? t('constants.addVersion') : t('constants.create')}
          </Button>
        )}
      </SheetFooter>
    </form>
  )
}

/**
 * Every version, newest first.
 *
 * This is the sheet's real job. A calc pins `{constantId, version}` at bind time, so appending a new
 * value does NOT move formulas already bound to an older one — behaviour that reads as "my edit did
 * nothing" unless the history is on screen to explain it.
 */
function VersionHistory({ constant }: { constant: ConstantDTO }) {
  const t = useTranslations()
  const format = useFormatter()
  const latest = constant.versions.at(-1)?.version

  return (
    <div className="space-y-2" data-testid="constant-versions">
      <p className="text-xs font-medium text-muted-foreground">
        {t('constants.history')}
      </p>
      <ul className="divide-y rounded-md border">
        {[...constant.versions].reverse().map((version) => (
          <li
            key={version.version}
            className="flex items-baseline justify-between gap-3 px-3 py-2"
          >
            <span className="flex min-w-0 items-baseline gap-2">
              <Badge
                variant={version.version === latest ? 'default' : 'secondary'}
                className="h-5 shrink-0 px-1.5 text-[10px] tabular-nums"
              >
                v{version.version}
              </Badge>
              <span className="truncate font-medium">{version.data}</span>
              {/* A value that did not normalize can never feed a calc. Silence here would be a
                  constant that looks usable and quietly never computes. */}
              {version.parse?.ok === false && (
                <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" aria-hidden="true" />
                  {t('constants.notNumeric')}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {version.num !== undefined && (
                <span className="mr-2">
                  {version.num}
                  {version.unit ? ` ${version.unit}` : ''}
                </span>
              )}
              {format.dateTime(new Date(version.ts), {
                dateStyle: 'medium',
              })}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {t('constants.pinnedNote')}
      </p>
    </div>
  )
}

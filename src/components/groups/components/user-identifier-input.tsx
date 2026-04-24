'use client'

import { useEffect, useMemo, useState } from 'react'
import { Fingerprint, Loader2, Plus, UserCheck, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { UserDTO, UserIdentifierType } from 'iom-sdk'

import { Button, Input, Badge } from '@/components/ui'
import { cn, isUUID, truncateText } from '@/lib/utils'
import { useUsers } from '@/hooks/api'

interface UserIdentifierInputProps {
  onResolve: (user: UserDTO) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

function userDtoFromUuid(uuid: string): UserDTO {
  return {
    userUUID: uuid,
    createdAt: '',
    identifier: uuid,
    identifierType: 'UUID',
  }
}

function getUserDisplayName(user: UserDTO): string {
  if (user.username) return user.username
  const cn = user.certificateInfo?.subjectFields?.CN
  if (cn) return cn
  return user.identifier
}

type DropdownStatus = 'loading' | 'error' | 'empty' | 'results'

export function UserIdentifierInput({
  onResolve,
  placeholder,
  disabled = false,
  className,
}: UserIdentifierInputProps) {
  const t = useTranslations()
  const [value, setValue] = useState('')
  const [debouncedValue, setDebouncedValue] = useState('')

  const trimmed = value.trim()
  const looksLikeUuid = isUUID(trimmed)
  const isUuidMode = trimmed.length > 0 && looksLikeUuid

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedValue(trimmed), 300)
    return () => clearTimeout(handle)
  }, [trimmed])

  const { useFindUserByIdentifier } = useUsers()
  const {
    data: matches,
    isFetching,
    isError,
  } = useFindUserByIdentifier(debouncedValue, {
    enabled: debouncedValue.length > 0 && !isUUID(debouncedValue),
  })

  const showResults = trimmed.length > 0 && !disabled && !isUuidMode
  const hasResults = !!matches && matches.length > 0

  const dropdownStatus: DropdownStatus = isFetching
    ? 'loading'
    : isError
      ? 'error'
      : hasResults
        ? 'results'
        : 'empty'

  const identifierTypeLabels = useMemo(
    () =>
      ({
        UserAuthUP: t('groups.identifierType.email'),
        UserAuthX509Certificate: t('groups.identifierType.certificate'),
      }) as Partial<Record<UserIdentifierType, string>>,
    [t]
  )

  const reset = () => {
    setValue('')
    setDebouncedValue('')
  }

  const handleSelect = (user: UserDTO) => {
    onResolve(user)
    reset()
  }

  const handleAddUuid = () => {
    if (disabled || !looksLikeUuid) return
    onResolve(userDtoFromUuid(trimmed))
    reset()
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isUuidMode) {
              e.preventDefault()
              handleAddUuid()
            }
          }}
          placeholder={placeholder ?? t('groups.userIdentifierPlaceholder')}
          disabled={disabled}
          className="flex-1"
        />
        {isUuidMode && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddUuid}
            disabled={disabled}
            className="h-8 gap-1"
            title={t('groups.addByUuid')}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('groups.addByUuid')}
          </Button>
        )}
        {value.length > 0 && !isUuidMode && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={reset}
            title={t('common.clear')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {isUuidMode && (
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Fingerprint className="h-3 w-3" />
          {t('groups.uuidDetected')}
        </div>
      )}

      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border bg-popover shadow-md">
          {dropdownStatus === 'loading' && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('groups.searchingUser')}
            </div>
          )}

          {dropdownStatus === 'error' && (
            <div className="px-3 py-2 text-xs text-destructive">
              {t('groups.userSearchError')}
            </div>
          )}

          {dropdownStatus === 'empty' && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t('groups.userNotFound')}
            </div>
          )}

          {dropdownStatus === 'results' && (
            <ul className="max-h-60 overflow-y-auto py-1">
              {matches!.map((user) => (
                <li key={user.userUUID}>
                  <button
                    type="button"
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">
                        {getUserDisplayName(user)}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {truncateText(user.userUUID, 40)}
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] h-5 px-1 shrink-0"
                    >
                      {identifierTypeLabels[user.identifierType] ??
                        user.identifierType}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { Crown, Globe, Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { GroupCreateDTO, GroupPermission } from 'iom-sdk'

import { Badge, CopyButton, Separator, Switch } from '@/components/ui'
import { cn } from '@/lib/utils'

interface GroupInfoTabProps {
  group: GroupCreateDTO
  isPublic: boolean
  isOwner: boolean
  canWrite: boolean
  isPending: boolean
  currentUserPermissions: GroupPermission[]
  permSource: 'owner' | 'user' | 'public' | 'none'
  onTogglePublic: (isPublic: boolean) => Promise<void>
}

export function GroupInfoTab({
  group,
  isPublic,
  isOwner,
  canWrite,
  isPending,
  currentUserPermissions,
  permSource,
  onTogglePublic,
}: GroupInfoTabProps) {
  const t = useTranslations()

  return (
    <div className="space-y-6 flex-1 overflow-auto mt-2">
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('groups.info')}</h3>
        <div className="space-y-3">
          {/* Visibility */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-1">
              <div className="font-medium">{t('groups.visibility')}</div>
              <div className="text-sm text-muted-foreground">
                {isPublic
                  ? t('groups.publicShortDescription')
                  : t('groups.privateShortDescription')}
              </div>
            </div>
            {canWrite ? (
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'gap-1',
                    isPublic
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  )}
                >
                  {isPublic ? (
                    <Globe className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {isPublic ? t('groups.public') : t('groups.private')}
                </Badge>
                <Switch
                  checked={isPublic}
                  disabled={isPending}
                  onCheckedChange={onTogglePublic}
                />
              </div>
            ) : (
              <Badge
                className={cn(
                  isPublic
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : 'bg-blue-100 text-blue-800 border-blue-200'
                )}
              >
                {isPublic ? (
                  <Globe className="h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                <span className="ml-1 capitalize">
                  {isPublic ? t('groups.public') : t('groups.private')}
                </span>
              </Badge>
            )}
          </div>

          {/* Your Permissions */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium">{t('groups.yourPermissions')}</div>
              <div className="text-sm text-muted-foreground">
                {isOwner
                  ? t('groups.ownerDescription')
                  : permSource === 'public'
                    ? t('groups.permissionsFromGroup')
                    : currentUserPermissions.length > 0
                      ? currentUserPermissions
                          .map((p) => t(`groups.permissions.${p}`))
                          .join(', ')
                      : t('groups.permissions.READ')}
              </div>
            </div>
            {isOwner ? (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-700 border-amber-200"
              >
                <Crown className="h-3.5 w-3.5 mr-1" />
                {t('groups.owner')}
              </Badge>
            ) : (
              currentUserPermissions.length > 0 && (
                <div className="flex items-center gap-1">
                  {currentUserPermissions.map((perm) => (
                    <Badge
                      key={perm}
                      variant="secondary"
                      className={cn(
                        'text-[10px] h-5 px-1',
                        permSource === 'public'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      )}
                    >
                      {t(`groups.permissions.${perm}`)}
                    </Badge>
                  ))}
                </div>
              )
            )}
          </div>

          <Separator />

          {/* Group UUID */}
          {group.groupUUID && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t('groups.groupUuid')}</div>
                <div className="text-sm text-muted-foreground font-mono truncate">
                  {group.groupUUID}
                </div>
              </div>
              <CopyButton
                text={group.groupUUID}
                label={t('groups.groupUuid')}
                size="sm"
                variant="ghost"
                showToast={true}
                className="shrink-0"
              />
            </div>
          )}

          {/* Owner UUID */}
          {group.ownerUserUUID && (
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t('groups.ownerUuid')}</div>
                <div className="text-sm text-muted-foreground font-mono truncate">
                  {group.ownerUserUUID}
                </div>
              </div>
              <CopyButton
                text={group.ownerUserUUID}
                label={t('groups.ownerUuid')}
                size="sm"
                variant="ghost"
                showToast={true}
                className="shrink-0"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

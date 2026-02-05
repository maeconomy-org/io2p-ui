'use client'

import { Info, Mail, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
} from '@/components/ui'
import { fetchClientConfig, type ClientConfig } from '@/constants'

interface ImportLimitsInfoProps {
  currentObjectCount?: number
  currentSizeMB?: number
  className?: string
  showContactForLarge?: boolean
}

export function ImportLimitsInfo({
  currentObjectCount = 0,
  currentSizeMB = 0,
  className,
  showContactForLarge = true,
}: ImportLimitsInfoProps) {
  const t = useTranslations()
  const [config, setConfig] = useState<ClientConfig | null>(null)

  useEffect(() => {
    fetchClientConfig().then(setConfig)
  }, [])

  if (!config) {
    return null // Loading state
  }

  const isLargeImport = currentObjectCount > config.maxObjectsPerImport * 0.8
  const isOversized = currentSizeMB > config.maxImportPayloadMB * 0.8
  const isExceedsLimits =
    currentObjectCount > config.maxObjectsPerImport ||
    currentSizeMB > config.maxImportPayloadMB

  const handleContactSupport = () => {
    const subject = encodeURIComponent(
      t('import.limits.mailSubject', { acronym: config.appAcronym })
    )
    const body = encodeURIComponent(
      t('import.limits.mailBody', {
        currentObjectCount: currentObjectCount.toLocaleString(),
        currentSizeMB: currentSizeMB.toFixed(2),
        maxObjectsPerImport: config.maxObjectsPerImport.toLocaleString(),
        maxFileSizeMB: config.maxFileSizeMB,
        maxImportPayloadMB: config.maxImportPayloadMB,
      })
    )

    window.open(`mailto:${config.supportEmail}?subject=${subject}&body=${body}`)
  }

  return (
    <div className={className}>
      {/* Current limits info */}
      <Alert
        variant={
          isExceedsLimits
            ? 'destructive'
            : isLargeImport || isOversized
              ? 'default'
              : 'default'
        }
      >
        <Info className="h-4 w-4" />
        <AlertTitle className="flex items-center gap-2">
          {t('import.limits.title')}
          {(isLargeImport || isOversized) && (
            <Badge variant={isExceedsLimits ? 'destructive' : 'secondary'}>
              {isExceedsLimits
                ? t('import.limits.exceedsLimits')
                : t('import.limits.largeImport')}
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">{t('import.limits.fileSize')}</div>
              <div className="text-muted-foreground">
                {t('import.limits.maxPerFile', { size: config.maxFileSizeMB })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('import.limits.fileSizeHint')}
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-medium">{t('import.limits.importSize')}</div>
              <div className="text-muted-foreground">
                {t('import.limits.maxPerImport', {
                  size: config.maxImportPayloadMB,
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('import.limits.importSizeHint')}
              </div>
              {currentSizeMB > 0 && (
                <div
                  className={`text-xs ${isOversized ? 'text-orange-600' : 'text-green-600'}`}
                >
                  {t('import.limits.currentSize', {
                    size: currentSizeMB.toFixed(2),
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-medium">
                {t('import.limits.objectCount')}
              </div>
              <div className="text-muted-foreground">
                {t('import.limits.maxObjects', {
                  count: config.maxObjectsPerImport.toLocaleString(),
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t('import.limits.objectCountHint')}
              </div>
              {currentObjectCount > 0 && (
                <div
                  className={`text-xs ${isLargeImport ? 'text-orange-600' : 'text-green-600'}`}
                >
                  {t('import.limits.currentObjects', {
                    count: currentObjectCount.toLocaleString(),
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Large import warning and support contact */}
          {showContactForLarge &&
            (isExceedsLimits ||
              (isLargeImport && currentObjectCount > 30000)) && (
              <div className="border-t pt-3 mt-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">
                      <strong>
                        {isExceedsLimits
                          ? t('import.limits.exceedsDescriptionTitle')
                          : t('import.limits.largeDescriptionTitle')}
                      </strong>{' '}
                      {t('import.limits.largeDescriptionBody')}
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>{t('import.limits.support.optimizedStrategies')}</li>
                      <li>{t('import.limits.support.temporaryIncreases')}</li>
                      <li>{t('import.limits.support.validation')}</li>
                      <li>{t('import.limits.support.performance')}</li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleContactSupport}
                      className="mt-2"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {t('import.limits.contactSupport', {
                        email: config.supportEmail,
                      })}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Tips for large imports */}
          {(isLargeImport || isOversized) && !isExceedsLimits && (
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-medium mb-2">
                {t('import.limits.tips.title')}
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>{t('import.limits.tips.breakDatasets')}</li>
                <li>{t('import.limits.tips.removeProperties')}</li>
                <li>{t('import.limits.tips.offPeak')}</li>
                <li>{t('import.limits.tips.chunkedUpload')}</li>
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

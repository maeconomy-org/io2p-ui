import { Info, Mail, AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
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
      `Large Import Request - ${config.appAcronym} Platform`
    )
    const body = encodeURIComponent(
      `Hello,\n\nI need to import a large dataset with the following specifications:\n\n` +
        `- Number of objects: ${currentObjectCount.toLocaleString()}\n` +
        `- Estimated size: ${currentSizeMB.toFixed(2)} MB\n` +
        `- Use case: [Please describe your use case]\n\n` +
        `Current platform limits:\n` +
        `- Max objects: ${config.maxObjectsPerImport.toLocaleString()}\n` +
        `- Max file size: ${config.maxFileSizeMB} MB\n` +
        `- Max import size: ${config.maxImportPayloadMB} MB\n\n` +
        `Please let me know how we can proceed with this import.\n\n` +
        `Best regards`
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
          Import Limits
          {(isLargeImport || isOversized) && (
            <Badge variant={isExceedsLimits ? 'destructive' : 'secondary'}>
              {isExceedsLimits ? 'Exceeds Limits' : 'Large Import'}
            </Badge>
          )}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">File Size</div>
              <div className="text-muted-foreground">
                Max: {config.maxFileSizeMB} MB per file
              </div>
              <div className="text-xs text-muted-foreground">
                Individual file upload limit
              </div>
            </div>

            <div className="space-y-1">
              <div className="font-medium">Import Size</div>
              <div className="text-muted-foreground">
                Max: {config.maxImportPayloadMB} MB per import
              </div>
              <div className="text-xs text-muted-foreground">
                Processed data size limit
              </div>
              {currentSizeMB > 0 && (
                <div
                  className={`text-xs ${isOversized ? 'text-orange-600' : 'text-green-600'}`}
                >
                  Current: {currentSizeMB.toFixed(2)} MB
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-medium">Object Count</div>
              <div className="text-muted-foreground">
                Max: {config.maxObjectsPerImport.toLocaleString()} objects
              </div>
              <div className="text-xs text-muted-foreground">
                Objects per single import
              </div>
              {currentObjectCount > 0 && (
                <div
                  className={`text-xs ${isLargeImport ? 'text-orange-600' : 'text-green-600'}`}
                >
                  Current: {currentObjectCount.toLocaleString()} objects
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
                      {isExceedsLimits ? (
                        <strong>Your import exceeds platform limits.</strong>
                      ) : (
                        <strong>Large import detected.</strong>
                      )}{' '}
                      For imports with more than 30,000 objects or complex
                      datasets, we recommend contacting our support team for
                      assistance with:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                      <li>Optimized import strategies</li>
                      <li>Temporary limit increases</li>
                      <li>Data validation and preprocessing</li>
                      <li>Performance optimization recommendations</li>
                    </ul>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleContactSupport}
                      className="mt-2"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Contact Support ({config.supportEmail})
                    </Button>
                  </div>
                </div>
              </div>
            )}

          {/* Tips for large imports */}
          {(isLargeImport || isOversized) && !isExceedsLimits && (
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-medium mb-2">
                Tips for large imports:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>
                  Break large datasets into smaller chunks (10,000-20,000
                  objects)
                </li>
                <li>Remove unnecessary properties to reduce payload size</li>
                <li>Import during off-peak hours for better performance</li>
                <li>Consider using the chunked upload for datasets over 5MB</li>
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}

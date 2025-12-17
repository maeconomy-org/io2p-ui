import { AlertTriangle, Clock, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

interface RateLimitInfo {
  current: number
  max: number
  windowMinutes: number
  resetTime: number
}

interface RateLimitWarningProps {
  rateLimitInfo?: RateLimitInfo
  warning?: string
  className?: string
}

export function RateLimitWarning({
  rateLimitInfo,
  warning,
  className,
}: RateLimitWarningProps) {
  if (!rateLimitInfo && !warning) {
    return null
  }

  const isNearLimit =
    rateLimitInfo && rateLimitInfo.current >= rateLimitInfo.max * 0.8
  const resetDate = rateLimitInfo ? new Date(rateLimitInfo.resetTime) : null
  const minutesUntilReset = resetDate
    ? Math.ceil((resetDate.getTime() - Date.now()) / (1000 * 60))
    : 0

  return (
    <Alert
      className={className}
      variant={isNearLimit ? 'destructive' : 'default'}
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Rate Limit Notice
        {rateLimitInfo && (
          <Badge variant={isNearLimit ? 'destructive' : 'secondary'}>
            {rateLimitInfo.current}/{rateLimitInfo.max}
          </Badge>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{warning || 'You are approaching the import rate limit.'}</p>

        {rateLimitInfo && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>Window: {rateLimitInfo.windowMinutes} minutes</span>
            </div>
            {minutesUntilReset > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Resets in: {minutesUntilReset} minutes</span>
              </div>
            )}
          </div>
        )}

        <p className="text-sm">
          <strong>Tip:</strong> For large datasets, consider breaking them into
          smaller imports or wait a few minutes between imports to avoid hitting
          limits.
        </p>
      </AlertDescription>
    </Alert>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  Database,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Clock,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Alert,
  AlertDescription,
  Progress,
} from '@/components/ui'
import { useAuth } from '@/contexts'
import { HEALTH_UI_ENABLED, HEALTH_UI_ALLOWED_CERTS } from '@/constants'

interface HealthData {
  status: 'healthy' | 'warning' | 'critical' | 'error'
  timestamp: string
  redis: {
    memory: {
      usedMB: number
      maxMB: number
      usedPercentage: number
      warning: boolean
      alert: boolean
    }
    keyCount: number
  }
  imports: {
    total: number
    active: number
    completed: number
    failed: number
    chunks: number
  }
  environment: {
    nodeEnv: string
    verifyCertificates: boolean
    allowInsecureFallback: boolean
  }
}

export default function HealthPage() {
  const router = useRouter()
  const { certFingerprint, certSerialNumber, isAuthenticated } = useAuth()
  const [healthData, setHealthData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Check if user has access
  const hasAccess = () => {
    if (!HEALTH_UI_ENABLED) return false
    if (!isAuthenticated) return false

    // If no specific certs are configured, allow any authenticated user
    if (!HEALTH_UI_ALLOWED_CERTS.trim()) return true

    // Check if user's cert is in allowed list
    const allowedCerts = HEALTH_UI_ALLOWED_CERTS.split(',').map((c) => c.trim())
    return (
      allowedCerts.includes(certFingerprint || '') ||
      allowedCerts.includes(certSerialNumber || '')
    )
  }

  const fetchHealthData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/system/health', {
        headers: {
          'x-admin-token': process.env.NEXT_PUBLIC_ADMIN_TOKEN || '',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setHealthData(data)
      setLastUpdated(new Date())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch health data'
      )
    } finally {
      setLoading(false)
    }
  }

  const triggerCleanup = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/system/health', {
        method: 'POST',
        headers: {
          'x-admin-token': process.env.NEXT_PUBLIC_ADMIN_TOKEN || '',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      alert(
        `Cleanup completed: ${result.result.jobsDeleted} jobs and ${result.result.chunksDeleted} chunks deleted`
      )

      // Refresh health data after cleanup
      await fetchHealthData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger cleanup')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasAccess()) {
      fetchHealthData()

      // Auto-refresh every 30 seconds
      const interval = setInterval(fetchHealthData, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, certFingerprint, certSerialNumber])

  if (!HEALTH_UI_ENABLED) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Health UI is disabled. Set HEALTH_UI_ENABLED=true to enable.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Redirect unauthorized users to main page
  useEffect(() => {
    if (!hasAccess()) {
      // router.push('/')
    }
  }, [hasAccess, router])

  if (!hasAccess()) {
    return null // Don't render anything while redirecting
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <XCircle className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor system status and performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <Button
            onClick={fetchHealthData}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button
            onClick={triggerCleanup}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Cleanup
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {healthData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* System Status */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                System Status
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {getStatusIcon(healthData.status)}
                <span
                  className={`text-2xl font-bold ${getStatusColor(healthData.status)}`}
                >
                  {healthData.status.charAt(0).toUpperCase() +
                    healthData.status.slice(1)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Environment: {healthData.environment.nodeEnv}
              </p>
            </CardContent>
          </Card>

          {/* Redis Memory */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Redis Memory
              </CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{healthData.redis.memory.usedMB} MB</span>
                  <span>{healthData.redis.memory.maxMB} MB</span>
                </div>
                <Progress value={healthData.redis.memory.usedPercentage} />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {healthData.redis.memory.usedPercentage.toFixed(1)}% used
                  </span>
                  {healthData.redis.memory.alert && (
                    <Badge variant="destructive">Critical</Badge>
                  )}
                  {healthData.redis.memory.warning &&
                    !healthData.redis.memory.alert && (
                      <Badge variant="secondary">Warning</Badge>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Keys: {healthData.redis.keyCount.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Import Statistics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Import Jobs</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="font-medium">
                      {healthData.imports.total}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div>
                    <div className="font-medium text-blue-600">
                      {healthData.imports.active}
                    </div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                  <div>
                    <div className="font-medium text-green-600">
                      {healthData.imports.completed}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-red-600">
                      {healthData.imports.failed}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Chunks: {healthData.imports.chunks.toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card className="md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Configuration
              </CardTitle>
              <CardDescription>
                Current security and certificate settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium">
                    Certificate Verification
                  </div>
                  <Badge
                    variant={
                      healthData.environment.verifyCertificates
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {healthData.environment.verifyCertificates
                      ? 'Enabled'
                      : 'Disabled'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium">Insecure Fallback</div>
                  <Badge
                    variant={
                      healthData.environment.allowInsecureFallback
                        ? 'secondary'
                        : 'default'
                    }
                  >
                    {healthData.environment.allowInsecureFallback
                      ? 'Allowed'
                      : 'Disabled'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium">Your Certificate</div>
                  <div className="text-xs text-muted-foreground">
                    {certFingerprint && (
                      <div>Fingerprint: {certFingerprint.slice(0, 16)}...</div>
                    )}
                    {certSerialNumber && <div>Serial: {certSerialNumber}</div>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

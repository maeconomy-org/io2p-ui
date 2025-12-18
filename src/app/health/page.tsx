'use client'

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
  Server,
  RotateCcw,
  ChevronDown,
  ChevronUp,
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
import { useHealthDashboard } from '@/hooks/use-health-dashboard'

export default function HealthPage() {
  const {
    healthData,
    loading,
    actionLoading,
    error,
    lastUpdated,
    expandedJob,
    jobFailures,
    hasAccess,
    isEnabled,
    fetchHealthData,
    triggerCleanup,
    retryJob,
    deleteJob,
    toggleJobExpand,
  } = useHealthDashboard()

  // Access control checks
  if (!isEnabled) {
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

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Your certificate is not authorized for the health
            dashboard.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Helper functions for rendering
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

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-'
    return new Date(timestamp).toLocaleString()
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
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
            disabled={actionLoading === 'cleanup'}
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  {healthData.environment.nodeEnv} |{' '}
                  {healthData.system?.uptimeFormatted || '-'}
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
                    <span>{healthData.redis.memory.maxMB || '∞'} MB</span>
                  </div>
                  <Progress
                    value={healthData.redis.memory.usedPercentage || 0}
                  />
                  <p className="text-xs text-muted-foreground">
                    Keys: {healthData.redis.keyCount.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Node.js Memory */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Node.js Memory
                </CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {healthData.system?.memory?.heapUsedMB || 0} MB
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Heap: {healthData.system?.memory?.heapUsedMB || 0} /{' '}
                    {healthData.system?.memory?.heapTotalMB || 0} MB
                  </p>
                  <p className="text-xs text-muted-foreground">
                    RSS: {healthData.system?.memory?.rssMB || 0} MB
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Import Stats */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Import Jobs
                </CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
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
                    <div className="text-xs text-muted-foreground">Done</div>
                  </div>
                  <div>
                    <div className="font-medium text-red-600">
                      {healthData.imports.failed}
                    </div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                  <div>
                    <div className="font-medium">
                      {healthData.imports.total}
                    </div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Jobs Table */}
          {healthData.jobs && healthData.jobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Import Jobs
                </CardTitle>
                <CardDescription>
                  View job details and retry failed imports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {healthData.jobs.map((job) => (
                    <div key={job.jobId} className="border rounded-lg">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleJobExpand(job.jobId)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedJob === job.jobId ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                          <div>
                            <div className="font-mono text-sm">
                              {job.jobId.slice(0, 8)}...
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(job.createdAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-right">
                            <div>
                              {job.processed}/{job.total} processed
                            </div>
                            {job.failedCount > 0 && (
                              <div className="text-red-600">
                                {job.failedCount} failed
                              </div>
                            )}
                          </div>
                          {getJobStatusBadge(job.status)}
                          {job.failedCount > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                retryJob(job.jobId)
                              }}
                              disabled={actionLoading === `retry-${job.jobId}`}
                            >
                              <RotateCcw
                                className={`h-3 w-3 mr-1 ${actionLoading === `retry-${job.jobId}` ? 'animate-spin' : ''}`}
                              />
                              Retry
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteJob(job.jobId)
                            }}
                            disabled={actionLoading === `delete-${job.jobId}`}
                          >
                            <Trash2
                              className={`h-3 w-3 mr-1 ${actionLoading === `delete-${job.jobId}` ? 'animate-spin' : ''}`}
                            />
                            Delete
                          </Button>
                        </div>
                      </div>

                      {expandedJob === job.jobId && (
                        <div className="border-t p-3 bg-muted/30">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <div className="text-muted-foreground">
                                Job ID
                              </div>
                              <div className="font-mono text-xs">
                                {job.jobId}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">
                                User UUID
                              </div>
                              <div className="font-mono text-xs">
                                {job.userUUID?.slice(0, 8) || '-'}...
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">
                                Created
                              </div>
                              <div>{formatDate(job.createdAt)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">
                                Completed
                              </div>
                              <div>{formatDate(job.completedAt)}</div>
                            </div>
                          </div>

                          {job.error && (
                            <Alert variant="destructive" className="mb-3">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>{job.error}</AlertDescription>
                            </Alert>
                          )}

                          {jobFailures[job.jobId] &&
                            jobFailures[job.jobId].length > 0 && (
                              <div>
                                <div className="text-sm font-medium mb-2">
                                  Recent Failures:
                                </div>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                  {jobFailures[job.jobId].map(
                                    (failure, idx) => (
                                      <div
                                        key={idx}
                                        className="text-xs p-2 bg-red-50 dark:bg-red-950 rounded"
                                      >
                                        <div className="flex justify-between">
                                          <span className="font-medium">
                                            {failure.errorType}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {new Date(
                                              failure.timestamp
                                            ).toLocaleTimeString()}
                                          </span>
                                        </div>
                                        <div className="text-muted-foreground truncate">
                                          {failure.error}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Settings */}
          <Card>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    {healthData.auth?.certFingerprint?.slice(0, 16) ||
                      'Not detected'}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Node Version</div>
                  <div className="text-xs text-muted-foreground">
                    {healthData.system?.nodeVersion || '-'}
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

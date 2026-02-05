import { BarChart3, Loader2, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button, Card, CardContent } from '@/components/ui'

export function LoadingState({
  isLoading,
  hasNoData,
  objectUuid,
  setIsProcessFormOpen,
  variant = 'card',
}: {
  isLoading: boolean
  hasNoData: boolean
  objectUuid: string | null
  setIsProcessFormOpen: (isOpen: boolean) => void
  variant?: 'card' | 'inline'
}) {
  const t = useTranslations()

  if (isLoading) {
    const loadingContent = (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">
            {t('processes.loadingState.loading')}
          </p>
        </div>
      </div>
    )

    if (variant === 'inline') {
      return (
        <div className="h-64 flex items-center justify-center">
          {loadingContent}
        </div>
      )
    }

    return (
      <Card>
        <CardContent className="h-96 flex items-center justify-center p-8">
          {loadingContent}
        </CardContent>
      </Card>
    )
  }

  if (hasNoData) {
    const emptyContent = (
      <div className="text-center">
        <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {t('processes.loadingState.noProcesses')}
        </h3>
        <p className="text-muted-foreground mb-4">
          {objectUuid
            ? t('processes.loadingState.noProcessesForObject')
            : t('processes.loadingState.noProcessesYet')}
        </p>
        <Button onClick={() => setIsProcessFormOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t('processes.loadingState.createFirst')}
        </Button>
      </div>
    )

    if (variant === 'inline') {
      return (
        <div className="h-64 flex items-center justify-center">
          {emptyContent}
        </div>
      )
    }

    return (
      <Card>
        <CardContent className="p-8">{emptyContent}</CardContent>
      </Card>
    )
  }

  return null
}

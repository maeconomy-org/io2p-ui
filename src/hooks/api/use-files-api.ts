import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

import { logger } from '@/lib'
import { useIomSdkClient } from '@/contexts'

export function useFilesApi() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()
  const t = useTranslations()

  const useSoftDeleteFile = () => {
    return useMutation({
      mutationFn: async (fileUuid: string) => {
        const response = await client.node.softDeleteFile(fileUuid)

        return response
      },
      onSuccess: () => {
        toast.success(t('objects.fileDeletedSuccess'))

        queryClient.invalidateQueries({ queryKey: ['aggregate'] })
      },
      onError: (error) => {
        logger.error('Failed to delete file:', error)
        toast.error(t('objects.fileDeleteFailed'))
      },
    })
  }

  return {
    useSoftDeleteFile,
  }
}

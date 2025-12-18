import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { logger } from '@/lib'
import { useIomSdkClient } from '@/contexts'

export function useFilesApi() {
  const client = useIomSdkClient()
  const queryClient = useQueryClient()

  const useSoftDeleteFile = () => {
    return useMutation({
      mutationFn: async (fileUuid: string) => {
        const response = await client.files.delete(fileUuid)

        return response.data
      },
      onSuccess: () => {
        toast.success('File deleted successfully')

        queryClient.invalidateQueries({ queryKey: ['aggregate'] })
      },
      onError: (error) => {
        logger.error('Failed to delete file:', error)
        toast.error('Failed to delete file')
      },
    })
  }

  return {
    useSoftDeleteFile,
  }
}

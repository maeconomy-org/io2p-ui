import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSDKStore, sdkSelectors } from '@/stores'
import { toast } from 'sonner'

interface DeleteOptions {
  type: 'object' | 'property' | 'statement' | 'file'
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function useUnifiedDelete(options: DeleteOptions) {
  const client = useSDKStore(sdkSelectors.client)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (uuid: string) => {
      switch (options.type) {
        case 'object':
          return await client.node.softDeleteObject(uuid)
        case 'property':
          return await client.node.softDeleteProperty(uuid)
        case 'file':
          // Note: files service doesn't exist in new SDK, using node
          throw new Error('File deletion not implemented in new SDK')
        default:
          throw new Error(`Unsupported delete type: ${options.type}`)
      }
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['objects'] })
      queryClient.invalidateQueries({ queryKey: ['properties'] })
      queryClient.invalidateQueries({ queryKey: ['aggregates'] })

      toast.success(`${options.type} deleted successfully`)
      options.onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete ${options.type}: ${error.message}`)
      options.onError?.(error.message)
    },
  })
}

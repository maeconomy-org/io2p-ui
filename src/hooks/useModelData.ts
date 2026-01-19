import { useQuery } from '@tanstack/react-query'
import { useSDKStore, sdkSelectors } from '@/stores'

export function useModelData() {
  const client = useSDKStore(sdkSelectors.client)

  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      if (!client) {
        throw new Error('SDK client not initialized')
      }

      // This is a placeholder - the actual implementation would depend on
      // what "models" means in your application context
      // For now, returning objects that might be templates
      const response = await client.node.getObjects({
        softDeleted: false,
        // Add any filters for model-like objects
      })
      return response
    },
    enabled: !!client && typeof window !== 'undefined', // Only run on client-side when client is available
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

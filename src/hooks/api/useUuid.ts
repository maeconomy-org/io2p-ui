import { useMutation } from '@tanstack/react-query'
import { useSDKStore, sdkSelectors } from '@/stores'

export function useUuid() {
  const client = useSDKStore(sdkSelectors.client)

  if (!client) {
    throw new Error('SDK client not initialized')
  }

  // Generate a new UUID
  const useGenerateUuid = () => {
    return useMutation({
      mutationFn: async () => {
        const response = await client.registry.createUUID()
        return response.uuid
      },
    })
  }

  return {
    useGenerateUuid,
  }
}

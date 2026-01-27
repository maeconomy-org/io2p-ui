import { useMutation } from '@tanstack/react-query'
import { useIomSdkClient } from '@/contexts'

export function useUuid() {
  const client = useIomSdkClient()

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

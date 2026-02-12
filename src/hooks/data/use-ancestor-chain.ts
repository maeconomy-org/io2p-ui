import { useQuery } from '@tanstack/react-query'

import { useIomSdkClient } from '@/contexts'

export interface AncestorItem {
  uuid: string
  name: string
}

/**
 * Fetches the ancestor chain for a given object UUID.
 * Walks up the parent hierarchy to build a breadcrumb path.
 * Returns ancestors from root → immediate parent (oldest first).
 */
export function useAncestorChain(uuid: string | undefined) {
  const client = useIomSdkClient()

  return useQuery<AncestorItem[]>({
    queryKey: ['ancestorChain', uuid],
    queryFn: async () => {
      if (!uuid) return []

      const ancestors: AncestorItem[] = []
      let currentUuid = uuid
      const visited = new Set<string>()

      // Walk up the parent chain (max 20 levels to prevent infinite loops)
      for (let i = 0; i < 20; i++) {
        if (visited.has(currentUuid)) break
        visited.add(currentUuid)

        const response = await client.node.searchAggregates({
          searchBy: { uuid: currentUuid },
          page: 0,
          size: 1,
        })

        const entity = response?.content?.[0]
        if (!entity) break

        const parentUuids: string[] = entity.parents || []
        if (parentUuids.length === 0) break

        // Follow the first parent (primary parent)
        const parentUuid = parentUuids[0]

        const parentResponse = await client.node.searchAggregates({
          searchBy: { uuid: parentUuid },
          page: 0,
          size: 1,
        })

        const parent = parentResponse?.content?.[0]
        if (!parent) break

        ancestors.unshift({
          uuid: parent.uuid as string,
          name: (parent.name || parent.uuid) as string,
        })
        currentUuid = parent.uuid as string
      }

      return ancestors
    },
    enabled: !!uuid,
    staleTime: 60000,
  })
}

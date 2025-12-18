import { useQueryClient } from '@tanstack/react-query'
import { useIomSdkClient } from '@/contexts'
import { logger } from '@/lib'

/**
 * Hook that provides the loadChildren function for columns view
 * Moved here from use-view-data.ts to keep columns-specific logic together
 */
export function useLoadChildren() {
  const queryClient = useQueryClient()
  const client = useIomSdkClient()

  // Children loading function for columns view with pagination and search
  // Uses queryClient.fetchQuery to share the same cache as useAggregateEntities hook
  const loadChildren = async (
    parentUUID: string,
    page = 1,
    searchTerm?: string,
    showDeleted = false
  ): Promise<{ items: any[]; totalPages: number; totalItems: number }> => {
    try {
      // Convert from 1-based (UI) to 0-based (API) page numbering
      const apiPage = page - 1

      logger.info(
        `🔄 Loading children for parent: ${parentUUID}, page: ${page} (API page: ${apiPage}), search: "${searchTerm || 'none'}"`
      )

      // Build params using the same structure as useAggregateEntities hook
      const params = {
        parentUUID,
        hasParentUUIDFilter: true,
        page: apiPage,
        size: 20,
        ...(searchTerm &&
          searchTerm.trim() && { searchTerm: searchTerm.trim() }),
        // Add softDeleted parameter for filtering deleted items
        ...(showDeleted ? {} : { searchBy: { softDeleted: false } }),
      }

      // Use queryClient.fetchQuery with the same query key and function as useAggregateEntities
      // This ensures proper caching and follows the centralized API pattern
      const response = await queryClient.fetchQuery({
        queryKey: ['aggregates', params],
        queryFn: async () => {
          const response = await client.aggregate.getAggregateEntities(params)
          return response.data
        },
        staleTime: 0, // Always fetch fresh data for children
      })

      // Transform and return the children data with pagination info
      const content = response?.content || []
      const items = content.map((obj: any) => ({
        ...obj,
        hasChildren: obj.children && obj.children.length > 0,
        childCount: obj.children ? obj.children.length : 0,
      }))

      return {
        items,
        totalPages: response?.totalPages || 1,
        totalItems: response?.totalElements || items.length,
      }
    } catch (error) {
      logger.error('Error loading children:', error)
      return {
        items: [],
        totalPages: 1,
        totalItems: 0,
      }
    }
  }

  return { loadChildren }
}

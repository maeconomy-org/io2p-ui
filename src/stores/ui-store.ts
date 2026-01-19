import { createStoreWithDevtools } from './utils/store-utils'

export interface UIState {
  // Command center state
  isCommandCenterOpen: boolean

  // Loading states for global operations
  isGlobalLoading: boolean
  globalLoadingMessage: string | null

  // Toast/notification state
  notifications: Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    message: string
    timestamp: number
    duration?: number
  }>

  // Modal state
  activeModal: string | null
  modalData: any

  // Sidebar state
  isSidebarOpen: boolean
  sidebarWidth: number

  // Theme state
  theme: 'light' | 'dark' | 'system'

  // Performance monitoring
  renderMetrics: Record<string, number>

  // Actions
  setCommandCenterOpen: (isOpen: boolean) => void
  setGlobalLoading: (isLoading: boolean, message?: string) => void
  addNotification: (
    notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>
  ) => string
  removeNotification: (id: string) => void
  clearNotifications: () => void
  openModal: (modalId: string, data?: any) => void
  closeModal: () => void
  setSidebarOpen: (isOpen: boolean) => void
  setSidebarWidth: (width: number) => void
  setTheme: (theme: UIState['theme']) => void
  trackRender: (componentName: string) => void
  getRenderMetrics: () => Record<string, number>
  resetRenderMetrics: () => void
}

export const useUIStore = createStoreWithDevtools<UIState>(
  (set, get) => ({
    // Initial state
    isCommandCenterOpen: false,
    isGlobalLoading: false,
    globalLoadingMessage: null,
    notifications: [],
    activeModal: null,
    modalData: null,
    isSidebarOpen: true,
    sidebarWidth: 280,
    theme: 'system',
    renderMetrics: {},

    // Command center actions
    setCommandCenterOpen: (isOpen) => {
      set((draft) => {
        draft.isCommandCenterOpen = isOpen
      })
    },

    // Global loading actions
    setGlobalLoading: (isLoading, message) => {
      set((draft) => {
        draft.isGlobalLoading = isLoading
        draft.globalLoadingMessage = message || null
      })
    },

    // Notification actions
    addNotification: (notification) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      set((draft) => {
        draft.notifications.push({
          ...notification,
          id,
          timestamp: Date.now(),
        })
      })

      // Auto-remove notification after duration (default 5 seconds)
      const duration = notification.duration || 5000
      if (duration > 0) {
        setTimeout(() => {
          get().removeNotification(id)
        }, duration)
      }

      return id
    },

    removeNotification: (id) => {
      set((draft) => {
        draft.notifications = draft.notifications.filter((n) => n.id !== id)
      })
    },

    clearNotifications: () => {
      set((draft) => {
        draft.notifications = []
      })
    },

    // Modal actions
    openModal: (modalId, data) => {
      set((draft) => {
        draft.activeModal = modalId
        draft.modalData = data
      })
    },

    closeModal: () => {
      set((draft) => {
        draft.activeModal = null
        draft.modalData = null
      })
    },

    // Sidebar actions
    setSidebarOpen: (isOpen) => {
      set((draft) => {
        draft.isSidebarOpen = isOpen
      })
    },

    setSidebarWidth: (width) => {
      set((draft) => {
        draft.sidebarWidth = Math.max(200, Math.min(400, width)) // Clamp between 200-400px
      })
    },

    // Theme actions
    setTheme: (theme) => {
      set((draft) => {
        draft.theme = theme
      })

      // Apply theme to document
      if (typeof window !== 'undefined') {
        const root = window.document.documentElement

        if (theme === 'system') {
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
            .matches
            ? 'dark'
            : 'light'
          root.classList.toggle('dark', systemTheme === 'dark')
        } else {
          root.classList.toggle('dark', theme === 'dark')
        }
      }
    },

    // Performance monitoring actions
    trackRender: (componentName) => {
      set((draft) => {
        draft.renderMetrics[componentName] =
          (draft.renderMetrics[componentName] || 0) + 1
      })

      if (process.env.NODE_ENV === 'development') {
        console.debug(
          `[Render Tracking] ${componentName}: ${get().renderMetrics[componentName]} renders`
        )
      }
    },

    getRenderMetrics: () => {
      return get().renderMetrics
    },

    resetRenderMetrics: () => {
      set((draft) => {
        draft.renderMetrics = {}
      })
    },
  }),
  {
    name: 'ui-store',
    persist: {
      key: 'iom-ui-state',
      partialize: (state) => ({
        // Only persist UI preferences, not temporary state
        isSidebarOpen: state.isSidebarOpen,
        sidebarWidth: state.sidebarWidth,
        theme: state.theme,
      }),
    },
  }
)

// Selectors for performance optimization
export const uiSelectors = {
  isCommandCenterOpen: (state: UIState) => state.isCommandCenterOpen,
  isGlobalLoading: (state: UIState) => state.isGlobalLoading,
  globalLoadingMessage: (state: UIState) => state.globalLoadingMessage,
  notifications: (state: UIState) => state.notifications,
  activeModal: (state: UIState) => state.activeModal,
  modalData: (state: UIState) => state.modalData,
  isSidebarOpen: (state: UIState) => state.isSidebarOpen,
  sidebarWidth: (state: UIState) => state.sidebarWidth,
  theme: (state: UIState) => state.theme,
  renderMetrics: (state: UIState) => state.renderMetrics,
}

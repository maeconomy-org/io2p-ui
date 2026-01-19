import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePagination } from '@/hooks/ui/use-pagination'

describe('usePagination', () => {
  const createPaginationData = (overrides = {}) => ({
    currentPage: 0,
    totalPages: 10,
    totalElements: 100,
    pageSize: 10,
    isFirstPage: true,
    isLastPage: false,
    ...overrides,
  })

  describe('initial state', () => {
    it('should return pagination data correctly', () => {
      const pagination = createPaginationData()
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      expect(result.current.currentPage).toBe(0)
      expect(result.current.totalPages).toBe(10)
      expect(result.current.totalElements).toBe(100)
      expect(result.current.pageSize).toBe(10)
      expect(result.current.isFirstPage).toBe(true)
      expect(result.current.isLastPage).toBe(false)
    })
  })

  describe('handlePageChange', () => {
    it('should call onPageChange with valid page number', () => {
      const pagination = createPaginationData({ currentPage: 5 })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handlePageChange(3)
      })

      expect(onPageChange).toHaveBeenCalledWith(3)
    })

    it('should not call onPageChange with negative page number', () => {
      const pagination = createPaginationData()
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handlePageChange(-1)
      })

      expect(onPageChange).not.toHaveBeenCalled()
    })

    it('should not call onPageChange with page >= totalPages', () => {
      const pagination = createPaginationData({ totalPages: 10 })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handlePageChange(10)
      })

      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('handleFirst', () => {
    it('should navigate to first page when not on first page', () => {
      const pagination = createPaginationData({
        currentPage: 5,
        isFirstPage: false,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handleFirst()
      })

      expect(onPageChange).toHaveBeenCalledWith(0)
    })

    it('should not navigate when already on first page', () => {
      const pagination = createPaginationData({ isFirstPage: true })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handleFirst()
      })

      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('handlePrevious', () => {
    it('should navigate to previous page when not on first page', () => {
      const pagination = createPaginationData({
        currentPage: 5,
        isFirstPage: false,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handlePrevious()
      })

      expect(onPageChange).toHaveBeenCalledWith(4)
    })

    it('should not navigate when on first page', () => {
      const pagination = createPaginationData({
        currentPage: 0,
        isFirstPage: true,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handlePrevious()
      })

      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('handleNext', () => {
    it('should navigate to next page when not on last page', () => {
      const pagination = createPaginationData({
        currentPage: 5,
        isLastPage: false,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handleNext()
      })

      expect(onPageChange).toHaveBeenCalledWith(6)
    })

    it('should not navigate when on last page', () => {
      const pagination = createPaginationData({
        currentPage: 9,
        isLastPage: true,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handleNext()
      })

      expect(onPageChange).not.toHaveBeenCalled()
    })
  })

  describe('handleLast', () => {
    it('should navigate to last page when not on last page', () => {
      const pagination = createPaginationData({
        currentPage: 5,
        totalPages: 10,
        isLastPage: false,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handleLast()
      })

      expect(onPageChange).toHaveBeenCalledWith(9)
    })

    it('should not navigate when already on last page', () => {
      const pagination = createPaginationData({
        currentPage: 9,
        isLastPage: true,
      })
      const onPageChange = vi.fn()

      const { result } = renderHook(() =>
        usePagination({ pagination, onPageChange })
      )

      act(() => {
        result.current.handleLast()
      })

      expect(onPageChange).not.toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { UploadCenter } from '@/components/upload-center/upload-center'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}))

const mockUpload = {
  tasks: [] as any[],
  summary: {
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0,
    uploading: 0,
  },
  isIdle: true,
  clearCompleted: vi.fn(),
  enqueue: vi.fn(),
}
let uploadReturnValue: typeof mockUpload | null = mockUpload

vi.mock('@/contexts/upload-queue-context', () => ({
  useOptionalUploadQueue: () => uploadReturnValue,
}))

function setUpload(update: Partial<typeof mockUpload>) {
  Object.assign(mockUpload, update)
  uploadReturnValue = mockUpload
}

describe('UploadCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setUpload({
      tasks: [],
      summary: {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        uploading: 0,
      },
      isIdle: true,
    })
    uploadReturnValue = mockUpload
  })

  it('returns null when no UploadProvider is mounted', () => {
    uploadReturnValue = null
    const { container } = render(<UploadCenter />)
    expect(container.firstChild).toBeNull()
  })

  it('renders only the idle sentinel when the queue is empty', () => {
    render(<UploadCenter />)
    expect(screen.getByTestId('upload-center-idle')).toBeInTheDocument()
    expect(screen.queryByTestId('upload-center')).not.toBeInTheDocument()
  })

  it('renders the in-progress widget with pending/uploading counts', () => {
    setUpload({
      tasks: [{ id: '1', status: 'uploading' }] as any,
      summary: {
        total: 2,
        completed: 0,
        failed: 0,
        pending: 1,
        uploading: 1,
      },
      isIdle: false,
    })
    render(<UploadCenter />)

    expect(screen.getByTestId('upload-center')).toBeInTheDocument()
    // No idle sentinel while uploading
    expect(screen.queryByTestId('upload-center-idle')).not.toBeInTheDocument()
    // Count label rendered
    expect(
      screen.getByText(/centerInProgress.*done.*0.*total.*2/)
    ).toBeInTheDocument()
    // Clear button hidden until idle
    expect(screen.queryByTestId('upload-center-clear')).not.toBeInTheDocument()
  })

  it('shows the failed banner and hides the idle sentinel when there are failures', () => {
    setUpload({
      tasks: [{ id: '1', status: 'failed' }] as any,
      summary: {
        total: 1,
        completed: 0,
        failed: 1,
        pending: 0,
        uploading: 0,
      },
      isIdle: true,
    })
    render(<UploadCenter />)

    expect(screen.getByText(/centerFailed.*count.*1/)).toBeInTheDocument()
    // Per component: idle sentinel is suppressed when failures exist
    expect(screen.queryByTestId('upload-center-idle')).not.toBeInTheDocument()
  })

  it('renders the idle sentinel AND the widget when there are only completed tasks', () => {
    setUpload({
      tasks: [{ id: '1', status: 'completed' }] as any,
      summary: {
        total: 1,
        completed: 1,
        failed: 0,
        pending: 0,
        uploading: 0,
      },
      isIdle: true,
    })
    render(<UploadCenter />)

    expect(screen.getByTestId('upload-center-idle')).toBeInTheDocument()
    expect(screen.getByTestId('upload-center')).toBeInTheDocument()
    expect(screen.getByTestId('upload-center-clear')).toBeInTheDocument()
  })

  it('invokes clearCompleted when the clear button is clicked', () => {
    setUpload({
      tasks: [{ id: '1', status: 'completed' }] as any,
      summary: {
        total: 1,
        completed: 1,
        failed: 0,
        pending: 0,
        uploading: 0,
      },
      isIdle: true,
    })
    render(<UploadCenter />)

    fireEvent.click(screen.getByTestId('upload-center-clear'))
    expect(mockUpload.clearCompleted).toHaveBeenCalledTimes(1)
  })
})

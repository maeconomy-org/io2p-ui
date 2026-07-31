import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const appendMock = vi.fn()
const constructorMock = vi.fn()

vi.mock('qr-code-styling', () => {
  return {
    default: class MockQRCodeStyling {
      constructor(opts: unknown) {
        constructorMock(opts)
      }
      append(node: HTMLElement) {
        appendMock(node)
      }
    },
  }
})

import { PassportQr } from '@/components/passport/components/passport-qr'

describe('PassportQr', () => {
  beforeEach(() => {
    appendMock.mockClear()
    constructorMock.mockClear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { origin: 'https://app.test' } as Location,
    })
  })

  it('renders the testid container with sized dimensions', () => {
    const { getByTestId } = render(<PassportQr uuid="abc-123" size={100} />)
    const node = getByTestId('passport-qr')
    expect(node).toBeTruthy()
    expect(node.style.width).toBe('100px')
    expect(node.style.height).toBe('100px')
    cleanup()
  })

  it('initialises QRCodeStyling with the bare uuid and level H', () => {
    render(<PassportQr uuid="abc-123" size={88} />)
    expect(constructorMock).toHaveBeenCalledTimes(1)
    const opts = constructorMock.mock.calls[0][0] as Record<string, unknown> & {
      qrOptions: { errorCorrectionLevel: string }
    }
    expect(opts.data).toBe('abc-123')
    expect(opts.qrOptions.errorCorrectionLevel).toBe('H')
    expect(opts.image).toBe('/maeconomy-logo-short.svg')
    cleanup()
  })

  it('clears the container DOM on unmount', () => {
    const { getByTestId, unmount } = render(<PassportQr uuid="abc-123" />)
    const node = getByTestId('passport-qr')
    node.innerHTML = '<svg>marker</svg>'
    unmount()
    expect(node.innerHTML).toBe('')
  })
})

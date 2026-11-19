import type {
  CornerSquareType,
  DotType,
  DrawType,
  Options,
} from 'qr-code-styling'

const LOGO_SRC = '/maeconomy-logo-short.svg'

interface BuildQrConfigArgs {
  data: string
  size?: number
  isPrint?: boolean
  withLogo?: boolean
  /**
   * Display renderer. Defaults to 'canvas' — `qr-code-styling`'s SVG mode has
   * known issues embedding raster logos on first paint. Canvas always works.
   * Download formats (PNG/SVG) are unaffected: the lib regenerates the QR
   * with the requested format internally.
   */
  type?: DrawType
}

export function buildQrCodeConfig({
  data,
  size = 260,
  isPrint = false,
  withLogo = true,
  type = 'canvas',
}: BuildQrConfigArgs): Options {
  const dimension = isPrint ? 1200 : size
  return {
    width: dimension,
    height: dimension,
    type,
    data,
    qrOptions: {
      errorCorrectionLevel: 'H',
    },
    dotsOptions: {
      color: '#000000',
      type: 'square' as DotType,
    },
    cornersSquareOptions: {
      type: 'extra-rounded' as CornerSquareType,
      color: '#000000',
    },
    backgroundOptions: {
      color: '#FFFFFF',
    },
    image: withLogo ? LOGO_SRC : undefined,
    imageOptions: {
      margin: isPrint ? 0 : 4,
      imageSize: 0.4,
      hideBackgroundDots: true,
    },
  }
}

export const BrickLoader = ({ size = 64, color = '#b5651d' }) => (
  <svg width={size} height={size} viewBox="0 0 64 48" fill="none">
    <style>{`
      @keyframes drawBrick {
        0%   { stroke-dashoffset: 500; opacity: 0.3; }
        50%  { stroke-dashoffset: 0;   opacity: 1; }
        100% { stroke-dashoffset: -500; opacity: 0.3; }
      }
      .brick { 
        stroke-dasharray: 500; 
        stroke-dashoffset: 500;
        animation: drawBrick 1.8s ease-in-out infinite;
      }
    `}</style>

    {/* Row 1 - full bricks */}
    <rect
      className="brick"
      x="2"
      y="2"
      width="28"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
    />
    <rect
      className="brick"
      x="34"
      y="2"
      width="28"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
    />

    {/* Row 2 - offset (like real brickwork) */}
    <rect
      className="brick"
      x="2"
      y="18"
      width="14"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '0.15s' }}
    />
    <rect
      className="brick"
      x="20"
      y="18"
      width="28"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '0.15s' }}
    />
    <rect
      className="brick"
      x="52"
      y="18"
      width="10"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '0.15s' }}
    />

    {/* Row 3 - full bricks */}
    <rect
      className="brick"
      x="2"
      y="34"
      width="28"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '0.3s' }}
    />
    <rect
      className="brick"
      x="34"
      y="34"
      width="28"
      height="12"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '0.3s' }}
    />
  </svg>
)

export const IBeamLoader = ({ size = 80, color = '#607D8B' }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" fill="none">
    <style>{`
      @keyframes drawIBeam {
        0%   { stroke-dashoffset: 280; }
        70%  { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -280; }
      }
      .ibeam { 
        stroke-dasharray: 280; 
        stroke-dashoffset: 280;
        animation: drawIBeam 1.8s ease-in-out infinite;
      }
    `}</style>
    {/* Top flange */}
    <line
      className="ibeam"
      x1="10"
      y1="8"
      x2="50"
      y2="8"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Web */}
    <line
      className="ibeam"
      x1="30"
      y1="8"
      x2="30"
      y2="52"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      style={{ animationDelay: '0.2s' }}
    />
    {/* Bottom flange */}
    <line
      className="ibeam"
      x1="10"
      y1="52"
      x2="50"
      y2="52"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      style={{ animationDelay: '0.4s' }}
    />
  </svg>
)

export const HexLoader = ({ size = 64, color = '#78909C' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <style>{`
      @keyframes drawHex {
        0%   { stroke-dashoffset: 200; }
        60%  { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -200; }
      }
      .hex-outer {
        stroke-dasharray: 200;
        stroke-dashoffset: 200;
        animation: drawHex 1.6s cubic-bezier(0.4,0,0.2,1) infinite;
      }
      .hex-inner {
        stroke-dasharray: 90;
        stroke-dashoffset: 90;
        animation: drawHex 1.6s cubic-bezier(0.4,0,0.2,1) 0.4s infinite;
      }
    `}</style>
    {/* Outer hex */}
    <polygon
      className="hex-outer"
      points="32,4 56,18 56,46 32,60 8,46 8,18"
      stroke={color}
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Inner circle (hole) */}
    <circle
      className="hex-inner"
      cx="32"
      cy="32"
      r="12"
      stroke={color}
      strokeWidth="2"
    />
  </svg>
)

export const WindowLoader = ({ size = 64, color = '#4FC3F7' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <style>{`
      @keyframes drawWindow {
        0%   { stroke-dashoffset: 300; opacity: 0.2; }
        50%  { stroke-dashoffset: 0;   opacity: 1; }
        100% { stroke-dashoffset: -300; opacity: 0.2; }
      }
      .win { stroke-dasharray: 300; stroke-dashoffset: 300; }
      .w1 { animation: drawWindow 2s ease-in-out infinite; }
      .w2 { animation: drawWindow 2s ease-in-out 0.2s infinite; }
      .w3 { animation: drawWindow 2s ease-in-out 0.4s infinite; }
      .w4 { animation: drawWindow 2s ease-in-out 0.6s infinite; }
    `}</style>
    {/* Outer frame */}
    <rect
      x="4"
      y="4"
      width="56"
      height="56"
      rx="2"
      stroke={color}
      strokeWidth="2.5"
      className="win w1"
    />
    {/* Vertical divider */}
    <line
      x1="32"
      y1="4"
      x2="32"
      y2="60"
      stroke={color}
      strokeWidth="2"
      className="win w2"
    />
    {/* Horizontal divider */}
    <line
      x1="4"
      y1="32"
      x2="60"
      y2="32"
      stroke={color}
      strokeWidth="2"
      className="win w3"
    />
    {/* Corner cross detail */}
    <circle
      cx="32"
      cy="32"
      r="3"
      stroke={color}
      strokeWidth="2"
      className="win w4"
    />
  </svg>
)

export const CraneLoader = ({ size = 80, color = '#FFA726' }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 60 84" fill="none">
    <style>{`
      @keyframes drawCrane {
        0%   { stroke-dashoffset: 400; }
        65%  { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -400; }
      }
      .crane {
        stroke-dasharray: 400;
        stroke-dashoffset: 400;
        animation: drawCrane 2.2s cubic-bezier(0.4,0,0.2,1) infinite;
      }
      .cable {
        stroke-dasharray: 80;
        stroke-dashoffset: 80;
        animation: drawCrane 2.2s cubic-bezier(0.4,0,0.2,1) 0.6s infinite;
      }
    `}</style>
    {/* Tower vertical */}
    <line
      className="crane"
      x1="20"
      y1="80"
      x2="20"
      y2="10"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Horizontal jib */}
    <line
      className="crane"
      x1="20"
      y1="14"
      x2="54"
      y2="14"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Counter-jib */}
    <line
      className="crane"
      x1="20"
      y1="14"
      x2="8"
      y2="14"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Diagonal support */}
    <line
      className="crane"
      x1="20"
      y1="22"
      x2="50"
      y2="14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <line
      className="crane"
      x1="20"
      y1="22"
      x2="10"
      y2="14"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Hanging cable + hook */}
    <line
      className="cable"
      x1="44"
      y1="14"
      x2="44"
      y2="44"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      className="cable"
      d="M40 44 Q44 50 48 44"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
)

export const CircularFlowLoader = ({ size = 64, color = '#66BB6A' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <style>{`
      @keyframes drawLoop {
        0%   { stroke-dashoffset: 320; }
        70%  { stroke-dashoffset: 0; }
        100% { stroke-dashoffset: -320; }
      }
      @keyframes rotateSlow {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      .loop-path {
        stroke-dasharray: 320;
        stroke-dashoffset: 320;
        animation: drawLoop 2s ease-in-out infinite;
        transform-origin: 32px 32px;
      }
      .loop-wrap {
        animation: rotateSlow 4s linear infinite;
        transform-origin: 32px 32px;
      }
    `}</style>
    <g className="loop-wrap">
      {/* 3-arrow recycling loop path */}
      <path
        className="loop-path"
        d="
          M32 8
          A24 24 0 0 1 53 44
          L47 44 L55 56 L63 44 L57 44
          A28 28 0 0 0 32 4
        "
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="loop-path"
        d="M32 56 A24 24 0 0 1 11 20"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        style={{ animationDelay: '0.3s' }}
      />
    </g>
  </svg>
)

export const BrickCycleLoader = ({ size = 80, color = '#FF8A65' }) => (
  <svg width={size} height={size} viewBox="0 0 80 64" fill="none">
    <style>{`
      @keyframes drawCycle {
        0%   { stroke-dashoffset: 400; opacity: 0.2; }
        50%  { stroke-dashoffset: 0;   opacity: 1; }
        100% { stroke-dashoffset: -400; opacity: 0.2; }
      }
      .b { stroke-dasharray: 400; stroke-dashoffset: 400; }
      .b1 { animation: drawCycle 2s ease-in-out infinite; }
      .b2 { animation: drawCycle 2s ease-in-out 0.2s infinite; }
      .b3 { animation: drawCycle 2s ease-in-out 0.4s infinite; }
      .arc { animation: drawCycle 2s ease-in-out 0.6s infinite; }
    `}</style>

    {/* Left: stacked bricks (source) */}
    <rect
      className="b b1"
      x="4"
      y="20"
      width="20"
      height="8"
      rx="1"
      stroke={color}
      strokeWidth="2"
    />
    <rect
      className="b b2"
      x="4"
      y="32"
      width="20"
      height="8"
      rx="1"
      stroke={color}
      strokeWidth="2"
    />
    <rect
      className="b b3"
      x="4"
      y="44"
      width="20"
      height="8"
      rx="1"
      stroke={color}
      strokeWidth="2"
    />

    {/* Circular flow arc top */}
    <path
      className="b arc"
      d="M14 18 Q40 2 66 18"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Arrow head right */}
    <path
      className="b arc"
      d="M62 14 L66 18 L61 20"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Circular flow arc bottom */}
    <path
      className="b arc"
      d="M66 46 Q40 62 14 46"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      style={{ animationDelay: '0.8s' }}
    />
    {/* Arrow head left */}
    <path
      className="b arc"
      d="M18 50 L14 46 L19 44"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animationDelay: '0.8s' }}
    />

    {/* Right: rebuilt bricks (output) */}
    <rect
      className="b b1"
      x="56"
      y="20"
      width="20"
      height="8"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '1s' }}
    />
    <rect
      className="b b2"
      x="56"
      y="32"
      width="20"
      height="8"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '1.2s' }}
    />
    <rect
      className="b b3"
      x="56"
      y="44"
      width="20"
      height="8"
      rx="1"
      stroke={color}
      strokeWidth="2"
      style={{ animationDelay: '1.4s' }}
    />
  </svg>
)

export const CircularRateLoader = ({
  size = 64,
  color = '#42A5F5',
  trackColor = '#E3F2FD',
}) => {
  const r = 26
  const circumference = 2 * Math.PI * r // ≈ 163

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <style>{`
        @keyframes fillRate {
          0%   { stroke-dashoffset: ${circumference}; }
          70%  { stroke-dashoffset: ${circumference * 0.15}; }
          100% { stroke-dashoffset: ${circumference}; }
        }
        @keyframes spinTrack {
          from { transform: rotate(-90deg); }
          to   { transform: rotate(270deg); }
        }
        .track { opacity: 0.2; }
        .rate-fill {
          stroke-dasharray: ${circumference};
          stroke-dashoffset: ${circumference};
          transform: rotate(-90deg);
          transform-origin: 32px 32px;
          animation: fillRate 2.4s cubic-bezier(0.4,0,0.2,1) infinite;
        }
      `}</style>

      {/* Background track */}
      <circle
        className="track"
        cx="32"
        cy="32"
        r={r}
        stroke={color}
        strokeWidth="5"
      />
      {/* Filling arc */}
      <circle
        className="rate-fill"
        cx="32"
        cy="32"
        r={r}
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Recycle arrows at center */}
      <path
        d="M27 29 L32 24 L37 29 M37 35 L32 40 L27 35"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  )
}

export const RebuildLoader = ({ size = 64, color = '#AB47BC' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <style>{`
      @keyframes buildUp {
        0%   { stroke-dashoffset: 260; opacity: 0; }
        40%  { stroke-dashoffset: 0;   opacity: 1; }
        70%  { stroke-dashoffset: 0;   opacity: 1; }
        100% { stroke-dashoffset: 0;   opacity: 0; }
      }
      @keyframes scatter {
        0%   { opacity: 0; transform: translate(0,0); }
        40%  { opacity: 1; transform: translate(0,0); }
        100% { opacity: 0; transform: translate(var(--dx), var(--dy)); }
      }
      .house {
        stroke-dasharray: 260;
        stroke-dashoffset: 260;
        animation: buildUp 2.4s ease-in-out infinite;
      }
      .particle {
        animation: scatter 2.4s ease-in-out infinite;
        transform-origin: center;
      }
      .p1 { --dx: -8px; --dy: -6px; animation-delay: 1.4s; }
      .p2 { --dx:  8px; --dy: -8px; animation-delay: 1.5s; }
      .p3 { --dx: -6px; --dy:  8px; animation-delay: 1.6s; }
      .p4 { --dx:  9px; --dy:  6px; animation-delay: 1.7s; }
    `}</style>

    {/* House outline */}
    <path
      className="house"
      d="M8 56 L8 30 L32 12 L56 30 L56 56 Z M24 56 L24 40 L40 40 L40 56"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    {/* Floating material particles */}
    <rect
      className="particle p1"
      x="10"
      y="20"
      width="5"
      height="3"
      rx="0.5"
      stroke={color}
      strokeWidth="1.5"
    />
    <rect
      className="particle p2"
      x="48"
      y="18"
      width="5"
      height="3"
      rx="0.5"
      stroke={color}
      strokeWidth="1.5"
    />
    <rect
      className="particle p3"
      x="12"
      y="44"
      width="5"
      height="3"
      rx="0.5"
      stroke={color}
      strokeWidth="1.5"
    />
    <rect
      className="particle p4"
      x="46"
      y="44"
      width="5"
      height="3"
      rx="0.5"
      stroke={color}
      strokeWidth="1.5"
    />
  </svg>
)

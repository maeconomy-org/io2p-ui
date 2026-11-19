type Node = { id: string; x: number; y: number; pulse?: boolean }

const NODES: Node[] = [
  { id: 'a', x: 18, y: 22, pulse: true },
  { id: 'b', x: 38, y: 14 },
  { id: 'c', x: 62, y: 28, pulse: true },
  { id: 'd', x: 84, y: 18 },
  { id: 'e', x: 12, y: 52 },
  { id: 'f', x: 32, y: 64 },
  { id: 'g', x: 56, y: 58, pulse: true },
  { id: 'h', x: 80, y: 70 },
  { id: 'i', x: 22, y: 86 },
  { id: 'j', x: 70, y: 90 },
]

const EDGES: Array<[string, string]> = [
  ['a', 'b'],
  ['b', 'c'],
  ['c', 'd'],
  ['a', 'e'],
  ['e', 'f'],
  ['f', 'g'],
  ['c', 'g'],
  ['g', 'h'],
  ['d', 'h'],
  ['f', 'i'],
  ['h', 'j'],
  ['i', 'j'],
]

const GLYPHS: Array<{
  char: string
  x: number
  y: number
  size: number
  opacity: number
  rotate: number
}> = [
  { char: '♻', x: 6, y: 8, size: 32, opacity: 0.06, rotate: -8 },
  { char: '⬡', x: 88, y: 6, size: 28, opacity: 0.08, rotate: 12 },
  { char: '⇌', x: 4, y: 40, size: 22, opacity: 0.07, rotate: 0 },
  { char: '⌂', x: 92, y: 44, size: 24, opacity: 0.05, rotate: 6 },
  { char: '↻', x: 48, y: 6, size: 20, opacity: 0.06, rotate: -4 },
  { char: '◇', x: 50, y: 78, size: 22, opacity: 0.05, rotate: 18 },
  { char: '⇄', x: 90, y: 84, size: 22, opacity: 0.06, rotate: 0 },
  { char: '↺', x: 22, y: 60, size: 20, opacity: 0.05, rotate: -14 },
  { char: '⌬', x: 60, y: 84, size: 22, opacity: 0.06, rotate: 0 },
]

const CHIPS: Array<{
  code: string
  x: number
  y: number
  opacity: number
}> = [
  { code: 'CON·12', x: 14, y: 18, opacity: 0.18 },
  { code: 'STL·09', x: 78, y: 38, opacity: 0.16 },
  { code: 'TMB·04', x: 26, y: 48, opacity: 0.14 },
  { code: 'BRK·21', x: 64, y: 70, opacity: 0.16 },
  { code: 'INS·07', x: 8, y: 64, opacity: 0.14 },
  { code: 'GLS·15', x: 86, y: 26, opacity: 0.12 },
  { code: 'ALU·02', x: 44, y: 88, opacity: 0.14 },
  { code: 'PVC·11', x: 32, y: 30, opacity: 0.12 },
]

const nodeById = (id: string) => NODES.find((n) => n.id === id)!

export function AuthPattern() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, rgb(255 255 255 / 0.08) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 35%, transparent 80%)',
          maskImage:
            'radial-gradient(ellipse at center, black 35%, transparent 80%)',
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="3"
            markerHeight="3"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill="rgb(255 255 255 / 0.3)" />
          </marker>
        </defs>

        {/* Curved arrow loops — circular flow / circular economy */}
        <g
          fill="none"
          stroke="rgb(255 255 255 / 0.22)"
          strokeWidth="0.22"
          strokeLinecap="round"
        >
          {/* Large counterclockwise loop, top-left quadrant */}
          <path d="M 22 8 A 28 28 0 1 0 8 36" markerEnd="url(#arrow)" />
          {/* Mid-size clockwise loop, bottom-right */}
          <path
            d="M 92 56 A 22 22 0 1 1 60 88"
            markerEnd="url(#arrow)"
            opacity="0.85"
          />
          {/* Small loop near center-right */}
          <path
            d="M 76 36 A 8 8 0 1 0 64 52"
            markerEnd="url(#arrow)"
            opacity="0.7"
          />
          {/* Small loop near bottom-left */}
          <path
            d="M 18 70 A 7 7 0 1 1 28 80"
            markerEnd="url(#arrow)"
            opacity="0.7"
          />
        </g>

        {/* Node graph (foreground) */}
        <g stroke="rgb(255 255 255 / 0.18)" strokeWidth="0.18" fill="none">
          {EDGES.map(([from, to]) => {
            const a = nodeById(from)
            const b = nodeById(to)
            return (
              <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            )
          })}
        </g>
        <g fill="rgb(255 255 255 / 0.55)">
          {NODES.map((n, idx) => (
            <circle
              key={n.id}
              cx={n.x}
              cy={n.y}
              r={n.pulse ? 0.7 : 0.5}
              className={n.pulse ? 'motion-safe:animate-pulse' : undefined}
              style={n.pulse ? { animationDelay: `${idx * 0.6}s` } : undefined}
            />
          ))}
        </g>
      </svg>

      {GLYPHS.map((g, i) => (
        <span
          key={i}
          className="absolute select-none font-light text-white"
          style={{
            left: `${g.x}%`,
            top: `${g.y}%`,
            fontSize: `${g.size}px`,
            opacity: g.opacity,
            transform: `translate(-50%, -50%) rotate(${g.rotate}deg)`,
          }}
        >
          {g.char}
        </span>
      ))}

      {CHIPS.map((m, i) => (
        <span
          key={i}
          className="absolute select-none rounded-full border border-white/20 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-wider text-white backdrop-blur-[1px]"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            opacity: m.opacity,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {m.code}
        </span>
      ))}

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgb(0 0 0 / 0.45) 90%)',
        }}
      />
    </div>
  )
}

export default AuthPattern

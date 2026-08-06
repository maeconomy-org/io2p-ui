// Process-level fatal handlers (server only), mirroring io2p-core/io2p-auth's
// fatal semantics: a background promise rejecting outside any request — or an
// exception escaping every handler — must land in the structured NDJSON/OTel
// stream (redacted, with the real `err`), get a best-effort flush, and then
// CRASH the process. Next's default would print plain text outside our
// pipeline; swallowing the error and keeping a corrupted process alive is not
// an option either — process.exit(1) preserves crash-on-fatal.

import { writeSync } from 'fs'

import { buildRecord } from './core'
import { otelBridgeActive, otelBridgeSink } from './server'

// globalThis guards: register() can run more than once (HMR, dev restarts),
// and instrumentation is bundled separately from route code, so module-level
// flags are not enough.
const INSTALLED = Symbol.for('io2p.fatalHandlersInstalled')

/**
 * Set by instrumentation.node.ts when the OTel SDK boots: a best-effort
 * flush (sdk.shutdown) so buffered spans/logs leave the process before the
 * fatal exit. Absent when OTEL_ENABLED is off.
 */
export const FATAL_FLUSH = Symbol.for('io2p.otelFlush')

type GlobalWithFatal = typeof globalThis & {
  [INSTALLED]?: boolean
  [FATAL_FLUSH]?: () => Promise<void>
}

const FLUSH_DEADLINE_MS = 2_000

let exiting = false

/**
 * The fatal line goes to fd 1 via fs.writeSync, NOT the normal NDJSON sink:
 * process.stdout.write is asynchronous on pipes (which is what a Docker log
 * driver is), and process.exit() does not drain pending stream writes — in
 * the OTEL-off branch the exit used to happen same-tick, so the one line
 * this feature exists for could vanish. writeSync blocks until the kernel
 * has the bytes. The record itself still comes from buildRecord (structured,
 * serialized err with cause chain, redacted); the OTel bridge gets the same
 * record when the SDK is up.
 */
function writeFatalRecord(kind: string, err: unknown): void {
  const rec = buildRecord('error', `Fatal: ${kind}`, { err, fatal: true })
  try {
    // The rawError symbol key is skipped by JSON.stringify by language rules.
    writeSync(1, JSON.stringify(rec) + '\n')
  } catch {
    // fd 1 is beyond help — the OTel bridge below is the remaining chance.
  }
  try {
    if (otelBridgeActive()) otelBridgeSink.write(rec)
  } catch {
    // Never let the bridge break the exit path.
  }
}

function handleFatal(kind: string): (err: unknown) => void {
  return (err: unknown): void => {
    // A second fatal while already exiting: nothing useful left to do, and
    // re-entering the flush path could deadlock the exit.
    if (exiting) return
    exiting = true

    // Nothing in here may throw — a throwing fatal handler is itself an
    // uncaught exception and would loop.
    try {
      writeFatalRecord(kind, err)
    } catch {
      // Proceed straight to the exit.
    }

    const exit = () => process.exit(1)
    try {
      const flush = (globalThis as GlobalWithFatal)[FATAL_FLUSH]
      if (flush) {
        void Promise.race([
          flush().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, FLUSH_DEADLINE_MS)),
        ]).finally(exit)
        // Belt and braces: if the race itself never settles, still die.
        const deadline = setTimeout(exit, FLUSH_DEADLINE_MS + 1_000)
        ;(deadline as { unref?: () => void }).unref?.()
      } else {
        exit()
      }
    } catch {
      exit()
    }
  }
}

/**
 * Idempotent. Called from the Node-gated instrumentation path regardless of
 * OTEL_ENABLED — fatal logging must not depend on the OTel SDK being on.
 */
export function registerFatalHandlers(): void {
  const g = globalThis as GlobalWithFatal
  if (g[INSTALLED]) return
  g[INSTALLED] = true

  process.on('unhandledRejection', handleFatal('unhandledRejection'))
  process.on('uncaughtException', handleFatal('uncaughtException'))
}

/** Test seam. */
export function resetFatalStateForTests(): void {
  exiting = false
  delete (globalThis as GlobalWithFatal)[INSTALLED]
  delete (globalThis as GlobalWithFatal)[FATAL_FLUSH]
}

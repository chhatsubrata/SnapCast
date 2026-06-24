/**
 * Screenshot event source abstraction.
 *
 * A source observes the host system in a NON-INVASIVE way (watching a folder
 * the user selects, or tailing a log file the user points at) and reports when
 * a screenshot *appears to have happened*. Sources never inspect other
 * processes, never hook OS screenshot APIs, and never alter any software — they
 * only read files the user has explicitly granted.
 */

import type { ScreenshotEvent, SourceConfig } from '@shared/types'

export type ScreenshotListener = (event: ScreenshotEvent) => void

export interface VerifyResult {
  detected: boolean
  /** Number of matching artifacts found during the verification probe. */
  sampleCount: number
  message: string
}

export interface ScreenshotSource {
  readonly config: SourceConfig
  /** Begin observing. Emitted events are passed to `listener`. */
  start(listener: ScreenshotListener): Promise<void>
  /** Stop observing and release all OS handles. */
  stop(): Promise<void>
  /** Probe the configured target to confirm screenshots can be detected. */
  verify(): Promise<VerifyResult>
}

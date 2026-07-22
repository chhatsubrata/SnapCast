import { describe, expect, it } from 'vitest'
import { anchorForRemaining, checkRemainingSeconds } from './fixed-interval'
import { PredictionEngine } from './PredictionEngine'
import { AlgorithmType, SourceType } from '../types'

const MIN = 60
const INTERVAL = 10 * MIN

describe('manual countdown entry', () => {
  it('accepts anything up to one whole interval', () => {
    expect(checkRemainingSeconds(1, INTERVAL).ok).toBe(true)
    expect(checkRemainingSeconds(5 * MIN, INTERVAL).ok).toBe(true)
    // Exactly the interval is the largest the countdown ever reads.
    expect(checkRemainingSeconds(INTERVAL, INTERVAL).ok).toBe(true)
  })

  it('rejects a time past the interval, and says why', () => {
    const over = checkRemainingSeconds(INTERVAL + 1, INTERVAL)
    expect(over.ok).toBe(false)
    expect(over.message).toContain('10-minute interval')

    expect(checkRemainingSeconds(11 * MIN, INTERVAL).ok).toBe(false)
  })

  it('rejects zero, negatives and junk', () => {
    expect(checkRemainingSeconds(0, INTERVAL).ok).toBe(false)
    expect(checkRemainingSeconds(-60, INTERVAL).ok).toBe(false)
    expect(checkRemainingSeconds(Number.NaN, INTERVAL).ok).toBe(false)
    expect(checkRemainingSeconds(Number.POSITIVE_INFINITY, INTERVAL).ok).toBe(false)
  })

  it('needs an interval to measure against', () => {
    expect(checkRemainingSeconds(60, 0).ok).toBe(false)
  })

  it('computes an anchor that makes the countdown read the entered time', () => {
    const now = 1_000_000
    const anchor = anchorForRemaining(now, 4 * MIN, INTERVAL)
    // next capture = anchor + interval, which must be 4 minutes out.
    expect(anchor + INTERVAL * 1000 - now).toBe(4 * MIN * 1000)
  })
})

describe('engine honours a hand-set anchor', () => {
  const now = 10_000_000

  function engineWithEventAt(eventTs: number, anchorTimestamp: number): PredictionEngine {
    const engine = new PredictionEngine({
      algorithm: AlgorithmType.FIXED_INTERVAL,
      initialEvents: [{ timestamp: eventTs, source: SourceType.MANUAL }]
    })
    engine.setFixedConfig({
      fixedIntervalMs: INTERVAL * 1000,
      anchorTimestamp,
      leadSeconds: 30
    })
    return engine
  }

  it('reads back the time that was set, even with a newer observed screenshot', () => {
    // A screenshot was seen a minute ago; the user then types "2 minutes left".
    const anchor = anchorForRemaining(now, 2 * MIN, INTERVAL)
    const engine = engineWithEventAt(now - 60_000, anchor)
    expect(engine.getPrediction(now).secondsRemaining).toBe(2 * MIN)
  })

  it('still falls back to the last screenshot when no anchor is set', () => {
    const engine = new PredictionEngine({
      algorithm: AlgorithmType.FIXED_INTERVAL,
      initialEvents: [{ timestamp: now - 60_000, source: SourceType.MANUAL }]
    })
    engine.setFixedConfig({
      fixedIntervalMs: INTERVAL * 1000,
      anchorTimestamp: null,
      leadSeconds: 30
    })
    expect(engine.getPrediction(now).secondsRemaining).toBe(9 * MIN)
  })
})

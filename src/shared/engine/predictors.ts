/**
 * Interval predictors.
 *
 * Each predictor takes the observed intervals (ms, oldest -> newest) and
 * returns its best estimate of the NEXT interval, or null when it lacks data.
 * They are intentionally simple and pure so they can be unit-tested in
 * isolation and swapped at runtime via {@link AlgorithmType}.
 *
 * Only the fixed-interval predictor is wired up for now; the rolling-average
 * and weighted predictors were removed and can be re-added here later.
 */

import { AlgorithmType } from '../types'

export interface Predictor {
  readonly type: AlgorithmType
  /** Estimate the next interval (ms) from historical intervals (ms). */
  predictInterval(intervals: number[]): number | null
}

/**
 * Assumes a fixed cadence: uses the most recent interval as the estimate.
 * Best when screenshots fire on a strict timer.
 */
export const fixedIntervalPredictor: Predictor = {
  type: AlgorithmType.FIXED_INTERVAL,
  predictInterval(intervals) {
    if (intervals.length === 0) return null
    return intervals[intervals.length - 1]
  }
}

/** Build the predictor matching a user-selected algorithm. */
export function createPredictor(_type: AlgorithmType): Predictor {
  return fixedIntervalPredictor
}

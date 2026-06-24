/**
 * Confidence and risk scoring.
 *
 * Confidence answers "how much should we trust the interval estimate?" and is
 * driven by two factors: how much data we have (more samples => steadier) and
 * how regular that data is (low variation => predictable).
 *
 * Risk answers "how likely is a screenshot imminent right now?" and rises as
 * the live countdown approaches (and passes) the estimated next-screenshot
 * moment, scaled by our confidence in that estimate.
 */

import { RiskLevel } from '../types'
import { coefficientOfVariation } from './statistics'

/** Below this sample count we are still warming up. */
export const MIN_SAMPLES_FOR_CONFIDENCE = 5
/** At/above this sample count the data-volume factor is maxed out. */
export const SAMPLES_FOR_FULL_CONFIDENCE = 30

/**
 * Compute a 0..1 confidence from the observed intervals.
 *
 * @param intervals observed gaps in ms (oldest -> newest)
 */
export function computeConfidence(intervals: number[]): number {
  if (intervals.length < MIN_SAMPLES_FOR_CONFIDENCE) {
    // Linearly ramp from 0 while warming up so the UI shows progress.
    return clamp01((intervals.length / MIN_SAMPLES_FOR_CONFIDENCE) * 0.35)
  }

  // Data-volume factor: 0.35..1 as samples grow.
  const volume = clamp01(
    0.35 +
      (0.65 * (intervals.length - MIN_SAMPLES_FOR_CONFIDENCE)) /
        (SAMPLES_FOR_FULL_CONFIDENCE - MIN_SAMPLES_FOR_CONFIDENCE)
  )

  // Regularity factor: 1 when CV is 0, decaying as variation grows.
  // CV of ~0.5 (intervals swing +/-50%) => ~0.5 regularity.
  const cv = coefficientOfVariation(intervals) ?? 1
  const regularity = clamp01(1 / (1 + cv))

  return clamp01(volume * regularity)
}

/**
 * Compute current risk (0..100) given how far we are through the predicted
 * interval and how confident we are.
 *
 * @param secondsRemaining seconds until the estimate (negative if overdue), or null
 * @param predictedIntervalMs the estimated interval length in ms, or null
 * @param confidence 0..1
 */
export function computeRiskPercentage(
  secondsRemaining: number | null,
  predictedIntervalMs: number | null,
  confidence: number
): number {
  if (secondsRemaining === null || predictedIntervalMs === null || predictedIntervalMs <= 0) {
    return 0
  }
  const intervalSeconds = predictedIntervalMs / 1000

  // Proximity: 0 at the start of an interval, 1 at (or past) the estimate.
  const elapsedFraction = 1 - secondsRemaining / intervalSeconds
  const proximity = clamp01(elapsedFraction)

  // Ease-in so risk stays calm early and climbs sharply near the estimate.
  const eased = proximity ** 2

  // Blend with confidence: an unsure estimate should not scream CRITICAL.
  // Floor of 0.4 keeps some signal even at low confidence.
  const confidenceWeight = 0.4 + 0.6 * confidence
  return Math.round(clamp01(eased * confidenceWeight) * 100)
}

/** Map a 0..100 risk percentage onto a severity bucket. */
export function riskLevelFromPercentage(riskPercentage: number): RiskLevel {
  if (riskPercentage >= 85) return RiskLevel.CRITICAL
  if (riskPercentage >= 65) return RiskLevel.HIGH
  if (riskPercentage >= 40) return RiskLevel.WARNING
  return RiskLevel.SAFE
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(1, Math.max(0, n))
}

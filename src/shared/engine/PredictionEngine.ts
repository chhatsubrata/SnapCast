/**
 * The screenshot prediction engine.
 *
 * Pure and deterministic: given the same events and the same "now", it always
 * yields the same prediction. It performs NO I/O — persistence, timers and the
 * notion of wall-clock "now" are the caller's responsibility (the main process
 * supplies them). This keeps the engine trivially unit-testable.
 *
 * The engine ONLY consumes screenshot events that the host application has
 * already observed from a user-configured source. It does not, and cannot,
 * interrogate, hook, or influence any screenshot software — it merely models
 * the timing of events handed to it.
 */

import {
  AlgorithmType,
  type LearningStats,
  type PredictionResult,
  RiskLevel,
  type ScreenshotEvent
} from '../types'
import { computeConfidence, computeRiskPercentage, riskLevelFromPercentage } from './confidence'
import { createPredictor } from './predictors'
import { max, mean, median, min, standardDeviation, toIntervals } from './statistics'

/** Hard cap on retained events, matching the product requirement. */
export const MAX_EVENTS = 1000

export interface PredictionEngineOptions {
  algorithm?: AlgorithmType
  /** Initial events to seed from persistence. */
  initialEvents?: ScreenshotEvent[]
}

/**
 * Runtime configuration for the user-driven FIXED_INTERVAL mode. Supplied by the
 * main process from settings; lets the engine produce a deterministic countdown
 * even with zero observed events.
 */
export interface FixedConfig {
  /** User-set cadence in ms (used as the interval when algorithm is FIXED_INTERVAL). */
  fixedIntervalMs: number | null
  /** Manual phase anchor (epoch ms) from the "Sync" button. */
  anchorTimestamp: number | null
  /** Seconds before the next estimate at which `imminent` flips true. */
  leadSeconds: number
}

export class PredictionEngine {
  private events: ScreenshotEvent[] = []
  private algorithm: AlgorithmType
  private fixed: FixedConfig = {
    fixedIntervalMs: null,
    anchorTimestamp: null,
    leadSeconds: 30
  }

  constructor(options: PredictionEngineOptions = {}) {
    this.algorithm = options.algorithm ?? AlgorithmType.FIXED_INTERVAL
    if (options.initialEvents?.length) {
      // Keep sorted and capped on load.
      this.events = [...options.initialEvents]
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-MAX_EVENTS)
    }
  }

  /** Record an observed screenshot event. Late/duplicate timestamps are kept ordered. */
  recordScreenshot(event: ScreenshotEvent): void {
    this.events.push(event)
    this.events.sort((a, b) => a.timestamp - b.timestamp)
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS)
    }
  }

  setAlgorithm(algorithm: AlgorithmType): void {
    this.algorithm = algorithm
  }

  /** Update the user-driven fixed-interval configuration (interval, anchor, lead). */
  setFixedConfig(config: FixedConfig): void {
    this.fixed = config
  }

  getAlgorithm(): AlgorithmType {
    return this.algorithm
  }

  /** Clear all learned data (used by "Restart Learning"). */
  reset(): void {
    this.events = []
  }

  getEvents(): ScreenshotEvent[] {
    return [...this.events]
  }

  /** Delete the event at `index` (index into the sorted event list). */
  deleteAt(index: number): boolean {
    if (index < 0 || index >= this.events.length) return false
    this.events.splice(index, 1)
    return true
  }

  /** Change the timestamp of the event at `index`, then re-sort. */
  updateAt(index: number, timestamp: number): boolean {
    if (index < 0 || index >= this.events.length) return false
    this.events[index] = { ...this.events[index], timestamp }
    this.events.sort((a, b) => a.timestamp - b.timestamp)
    return true
  }

  private timestamps(): number[] {
    return this.events.map((e) => e.timestamp)
  }

  /** Aggregate statistics over observed intervals. */
  getStats(): LearningStats {
    const intervals = toIntervals(this.timestamps())
    const lastScreenshot = this.events.length ? this.events[this.events.length - 1].timestamp : null
    return {
      totalEvents: this.events.length,
      averageInterval: mean(intervals),
      medianInterval: median(intervals),
      minInterval: min(intervals),
      maxInterval: max(intervals),
      standardDeviation: standardDeviation(intervals),
      lastScreenshot,
      isLearning: intervals.length < 5
    }
  }

  getRiskLevel(now: number = Date.now()): RiskLevel {
    return this.getPrediction(now).riskLevel
  }

  /**
   * Produce the full prediction for a given "now" (epoch ms).
   *
   * @param now current epoch ms; injectable for testing and for the per-second
   *            renderer refresh.
   */
  getPrediction(now: number = Date.now()): PredictionResult {
    const intervals = toIntervals(this.timestamps())
    const lastScreenshot = this.events.length ? this.events[this.events.length - 1].timestamp : null

    // Fixed-interval mode: the cadence comes straight from settings (a strict-timer
    // tracker), so the countdown works with zero observed events. Only fixed mode
    // exists right now, so a configured interval always wins; we fall back to the
    // history predictor only when no interval is set.
    const useFixed = this.fixed.fixedIntervalMs != null
    const predictedInterval = useFixed
      ? this.fixed.fixedIntervalMs
      : createPredictor(this.algorithm).predictInterval(intervals)

    // A deterministic timer needs no learning, so treat its confidence as full —
    // this keeps the risk ring/colours meaningful before any event is observed.
    const confidence = useFixed ? 1 : computeConfidence(intervals)

    // Anchor the cycle on whichever is most recent: the last observed screenshot
    // or the manual "Sync" timestamp. Either alone is enough to start counting.
    //
    // Exception: in fixed-interval mode an explicit anchor wins outright. The
    // user setting the phase by hand ("Sync now", or typing the remaining time)
    // is a deliberate statement about where the cycle sits, and an older
    // observed screenshot must not silently override it — with `max` a
    // deliberately backdated anchor would simply be ignored.
    const anchor =
      useFixed && this.fixed.anchorTimestamp !== null
        ? this.fixed.anchorTimestamp
        : maxNullable(lastScreenshot, this.fixed.anchorTimestamp)

    const empty: PredictionResult = {
      nextEstimatedScreenshot: null,
      confidence,
      riskPercentage: 0,
      riskLevel: RiskLevel.SAFE,
      secondsRemaining: null,
      intervalProgress: 0,
      imminent: false,
      algorithm: this.algorithm
    }

    if (predictedInterval === null || predictedInterval <= 0 || anchor === null) {
      return empty
    }

    // Roll the estimate forward past any missed intervals so the countdown
    // always points at the *next* future estimate rather than a stale past one.
    let nextEstimate = anchor + predictedInterval
    while (nextEstimate <= now) {
      nextEstimate += predictedInterval
    }

    const secondsRemaining = Math.max(0, Math.round((nextEstimate - now) / 1000))
    const riskPercentage = computeRiskPercentage(secondsRemaining, predictedInterval, confidence)
    const intervalProgress = Math.min(
      1,
      Math.max(0, 1 - (nextEstimate - now) / predictedInterval)
    )
    const imminent = secondsRemaining <= this.fixed.leadSeconds

    return {
      nextEstimatedScreenshot: nextEstimate,
      confidence,
      riskPercentage,
      riskLevel: riskLevelFromPercentage(riskPercentage),
      secondsRemaining,
      intervalProgress,
      imminent,
      algorithm: this.algorithm
    }
  }
}

/** Largest of two nullable epoch timestamps; null only when both are null. */
function maxNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b
  if (b === null) return a
  return Math.max(a, b)
}

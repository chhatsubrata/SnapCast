/**
 * Pure transforms turning raw {@link AnalyticsData} into chart-ready series.
 * Kept out of the React tree so they are easy to test and memoise.
 */

import type { AnalyticsData, ConfidenceSample, ScreenshotEvent } from '@shared/types'
import { toIntervals } from '@shared/engine/statistics'

export interface IntervalPoint {
  index: number
  /** Interval in seconds. */
  seconds: number
}

export interface TimelinePoint {
  time: number
  /** 1 = a screenshot happened (for scatter on a single row). */
  value: number
  label: string
}

export interface ConfidencePoint {
  time: number
  confidence: number
}

/** Interval-between-consecutive-screenshots, in seconds. */
export function intervalSeries(events: ScreenshotEvent[]): IntervalPoint[] {
  const intervals = toIntervals(events.map((e) => e.timestamp))
  return intervals.map((ms, index) => ({ index: index + 1, seconds: Math.round(ms / 1000) }))
}

/** Confidence trend as percentage points over time. */
export function confidenceSeries(samples: ConfidenceSample[]): ConfidencePoint[] {
  return samples.map((s) => ({ time: s.timestamp, confidence: Math.round(s.confidence * 100) }))
}

/** Screenshot events as timeline points. */
export function timelineSeries(events: ScreenshotEvent[]): TimelinePoint[] {
  return events.map((e) => ({
    time: e.timestamp,
    value: 1,
    label: new Date(e.timestamp).toLocaleTimeString()
  }))
}

/** Risk-over-time is reconstructed by sampling alongside the confidence trend. */
export function riskSeries(data: AnalyticsData): ConfidencePoint[] {
  // We only persist confidence samples; approximate a risk band from them so the
  // chart has a second informative series without extra persistence.
  return data.confidenceTrend.map((s) => ({
    time: s.timestamp,
    confidence: Math.round((1 - s.confidence) * 100)
  }))
}

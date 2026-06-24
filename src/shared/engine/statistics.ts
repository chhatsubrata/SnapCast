/**
 * Pure statistical helpers operating on interval arrays (milliseconds).
 *
 * All functions are total: they return `null` for empty input rather than
 * NaN/throwing, so callers never need to guard against divide-by-zero.
 */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function min(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values)
}

export function max(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values)
}

/** Population standard deviation. Returns 0 for a single value, null for empty. */
export function standardDeviation(values: number[]): number | null {
  if (values.length === 0) return null
  const m = mean(values)!
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Convert an ordered list of event timestamps (epoch ms) into the gaps
 * between consecutive events. Out-of-order timestamps are sorted first.
 */
export function toIntervals(timestamps: number[]): number[] {
  if (timestamps.length < 2) return []
  const sorted = [...timestamps].sort((a, b) => a - b)
  const intervals: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    intervals.push(sorted[i] - sorted[i - 1])
  }
  return intervals
}

/**
 * Coefficient of variation (stddev / mean): a unitless measure of how regular
 * the intervals are. 0 means perfectly periodic; higher means noisier.
 * Returns null when it cannot be computed.
 */
export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values)
  const sd = standardDeviation(values)
  if (m === null || sd === null || m === 0) return null
  return sd / m
}

/**
 * Pure formatting helpers for the UI. No React, easily unit-tested.
 */

/** Format seconds as mm:ss (or h:mm:ss past an hour). Null -> em dash. */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Format a ms interval as a human string like "1m 30s" or "45s". */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

/** Format an epoch ms timestamp as a local clock time. Null -> em dash. */
export function formatClock(timestamp: number | null): string {
  if (timestamp === null) return '—'
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

/** 0..1 -> "81%" */
export function formatPercent01(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** 0..100 -> "87%" */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

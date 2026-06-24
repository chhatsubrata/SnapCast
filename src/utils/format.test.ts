import { describe, expect, it } from 'vitest'
import { formatCountdown, formatDuration, formatPercent, formatPercent01 } from './format'

describe('format', () => {
  it('formats countdown mm:ss and h:mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(75)).toBe('01:15')
    expect(formatCountdown(3661)).toBe('1:01:01')
    expect(formatCountdown(null)).toBe('--:--')
    expect(formatCountdown(-5)).toBe('--:--')
  })

  it('formats durations from ms', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(45_000)).toBe('45s')
    expect(formatDuration(90_000)).toBe('1m 30s')
    expect(formatDuration(120_000)).toBe('2m')
  })

  it('formats percentages', () => {
    expect(formatPercent01(0.81)).toBe('81%')
    expect(formatPercent(87.4)).toBe('87%')
  })
})

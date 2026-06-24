import { describe, expect, it } from 'vitest'
import { AlgorithmType, RiskLevel, SourceType } from '../types'
import { PredictionEngine } from './PredictionEngine'
import { coefficientOfVariation, median, toIntervals } from './statistics'
import { computeConfidence, riskLevelFromPercentage } from './confidence'

const SEC = 1000
const ev = (timestamp: number) => ({ timestamp, source: SourceType.MANUAL })

describe('statistics', () => {
  it('computes intervals from sorted timestamps', () => {
    expect(toIntervals([0, 10, 30])).toEqual([10, 20])
    expect(toIntervals([30, 0, 10])).toEqual([10, 20])
    expect(toIntervals([5])).toEqual([])
  })

  it('computes median for odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
  })

  it('reports lower CV for regular intervals', () => {
    const regular = coefficientOfVariation([100, 100, 100, 100])!
    const irregular = coefficientOfVariation([20, 200, 50, 300])!
    expect(regular).toBeLessThan(irregular)
  })
})

describe('confidence', () => {
  it('is low when warming up and high when regular and plentiful', () => {
    const few = computeConfidence([100, 100])
    const many = computeConfidence(Array.from({ length: 40 }, () => 100))
    expect(few).toBeLessThan(0.4)
    expect(many).toBeGreaterThan(0.8)
  })

  it('maps risk percentages to severity buckets', () => {
    expect(riskLevelFromPercentage(10)).toBe(RiskLevel.SAFE)
    expect(riskLevelFromPercentage(50)).toBe(RiskLevel.WARNING)
    expect(riskLevelFromPercentage(70)).toBe(RiskLevel.HIGH)
    expect(riskLevelFromPercentage(90)).toBe(RiskLevel.CRITICAL)
  })
})

describe('PredictionEngine', () => {
  it('returns an empty prediction with no data', () => {
    const engine = new PredictionEngine()
    const p = engine.getPrediction(0)
    expect(p.nextEstimatedScreenshot).toBeNull()
    expect(p.riskLevel).toBe(RiskLevel.SAFE)
  })

  it('predicts the next screenshot for a steady 60s cadence', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    for (let i = 0; i < 10; i++) engine.recordScreenshot(ev(i * 60 * SEC))
    const now = 9 * 60 * SEC + 10 * SEC // 10s after last event
    const p = engine.getPrediction(now)
    expect(p.nextEstimatedScreenshot).toBe(10 * 60 * SEC)
    expect(p.secondsRemaining).toBe(50)
    // 9 perfectly-regular intervals: regularity is maxed, volume factor still ramping.
    expect(p.confidence).toBeGreaterThan(0.4)
  })

  it('grows confidence toward 1 with many regular samples', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    for (let i = 0; i < 40; i++) engine.recordScreenshot(ev(i * 60 * SEC))
    expect(engine.getPrediction(40 * 60 * SEC).confidence).toBeGreaterThan(0.85)
  })

  it('rolls the estimate forward past missed intervals', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    engine.recordScreenshot(ev(0))
    engine.recordScreenshot(ev(60 * SEC))
    // 'now' is far in the future; estimate must be the next FUTURE multiple.
    const p = engine.getPrediction(250 * SEC)
    expect(p.nextEstimatedScreenshot).toBe(300 * SEC)
  })

  it('caps retained events at 1000', () => {
    const engine = new PredictionEngine()
    for (let i = 0; i < 1200; i++) engine.recordScreenshot(ev(i * SEC))
    expect(engine.getEvents().length).toBe(1000)
  })

  it('reset clears learned data', () => {
    const engine = new PredictionEngine()
    engine.recordScreenshot(ev(0))
    engine.reset()
    expect(engine.getStats().totalEvents).toBe(0)
  })
})

describe('PredictionEngine — user fixed interval', () => {
  const fixed = (overrides = {}) => ({
    fixedIntervalMs: 600 * SEC,
    anchorTimestamp: null as number | null,
    leadSeconds: 30,
    ...overrides
  })

  it('counts down from a Sync anchor with zero observed events', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    engine.setFixedConfig(fixed({ anchorTimestamp: 0 }))
    const p = engine.getPrediction(40 * SEC) // 40s into the first 10-min cycle
    expect(p.nextEstimatedScreenshot).toBe(600 * SEC)
    expect(p.secondsRemaining).toBe(560)
    expect(p.confidence).toBe(1) // deterministic timer needs no learning
    expect(p.imminent).toBe(false)
  })

  it('flips imminent within the lead window and rolls over each cycle', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    engine.setFixedConfig(fixed({ fixedIntervalMs: 60 * SEC, anchorTimestamp: 0, leadSeconds: 30 }))

    expect(engine.getPrediction(25 * SEC).imminent).toBe(false) // 35s left
    expect(engine.getPrediction(31 * SEC).imminent).toBe(true) // 29s left -> within 30s lead

    // Next cycle: estimate rolls forward to 120s, countdown restarts.
    const rolled = engine.getPrediction(65 * SEC)
    expect(rolled.nextEstimatedScreenshot).toBe(120 * SEC)
    expect(rolled.secondsRemaining).toBe(55)
    expect(rolled.imminent).toBe(false)
  })

  it('prefers the most recent of observed event and Sync anchor', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    engine.recordScreenshot(ev(0))
    // A Sync at 100s is later than the last event at 0, so it anchors the cycle.
    engine.setFixedConfig(fixed({ fixedIntervalMs: 60 * SEC, anchorTimestamp: 100 * SEC }))
    const p = engine.getPrediction(110 * SEC)
    expect(p.nextEstimatedScreenshot).toBe(160 * SEC)
  })

  it('falls back to learned cadence when no fixed interval is set', () => {
    const engine = new PredictionEngine({ algorithm: AlgorithmType.FIXED_INTERVAL })
    engine.setFixedConfig(fixed({ fixedIntervalMs: null }))
    engine.recordScreenshot(ev(0))
    engine.recordScreenshot(ev(60 * SEC))
    const p = engine.getPrediction(70 * SEC)
    expect(p.nextEstimatedScreenshot).toBe(120 * SEC) // uses observed 60s interval
  })
})

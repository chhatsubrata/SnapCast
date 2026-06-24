/**
 * Central runtime service. Wires the pure {@link PredictionEngine} to the rest
 * of the main process: persistence, the active screenshot source, the 1 Hz tick
 * that drives the live countdown, notifications, the auto-hide rule, and all the
 * typed pushes the renderer subscribes to.
 *
 * It is the single owner of "current truth" so IPC handlers stay thin.
 */

import {
  AlgorithmType,
  type AnalyticsData,
  type AppSettings,
  type ConfidenceSample,
  DEFAULT_SETTINGS,
  type PredictionResult,
  RiskLevel,
  type ScreenshotEvent,
  type SourceType,
  type StatusBadge
} from '@shared/types'
import { PredictionEngine } from '@shared/engine/PredictionEngine'
import { SourceManager } from '../sources'
import { NotificationManager } from '../notifications'
import type { WindowManager } from '../window-manager'
import {
  loadConfidenceTrend,
  loadEvents,
  loadSettings,
  saveConfidenceTrend,
  saveEvents,
  saveSettings
} from '../store'
import { logger } from '../logger'

const TICK_MS = 1000
/** Sample the confidence trend at most this often. */
const TREND_SAMPLE_MS = 30_000
/** After an auto-hide re-show, suppress re-hiding for this long. */
const AUTOHIDE_COOLDOWN_MS = 5_000
/** Stay hidden this many seconds past the estimated capture before re-showing. */
const AUTOHIDE_POST_CAPTURE_S = 5

export class PredictionService {
  private engine: PredictionEngine
  private settings: AppSettings
  private sources = new SourceManager()
  private notifications: NotificationManager
  private confidenceTrend: ConfidenceSample[]

  private tick: NodeJS.Timeout | null = null
  private lastRiskLevel: RiskLevel = RiskLevel.SAFE
  private lastTrendSampleAt = 0
  private autoHideSuppressedUntil = 0
  private wasLearning = true
  private crossedConfidenceThreshold = false

  constructor(private readonly windows: WindowManager) {
    this.settings = loadSettings()
    this.confidenceTrend = loadConfidenceTrend()
    this.engine = new PredictionEngine({
      algorithm: this.settings.prediction.algorithm,
      initialEvents: loadEvents()
    })
    this.notifications = new NotificationManager(this.settings.notifications, () =>
      this.windows.send('notification:sound', undefined)
    )
    this.sources.setListener((event) => this.onScreenshot(event))
    this.applyEngineConfig()
  }

  /** Push the current prediction settings (algorithm + fixed-interval config) into the engine. */
  private applyEngineConfig(): void {
    const p = this.settings.prediction
    this.engine.setAlgorithm(p.algorithm)
    this.engine.setFixedConfig({
      fixedIntervalMs: p.fixedIntervalSeconds > 0 ? p.fixedIntervalSeconds * 1000 : null,
      anchorTimestamp: p.anchorTimestamp,
      leadSeconds: p.leadSeconds
    })
  }

  /** Start the active source and the per-second prediction loop. */
  async start(): Promise<void> {
    await this.activateSource()
    this.tick = setInterval(() => this.onTick(), TICK_MS)
    this.wasLearning = this.engine.getStats().isLearning
    logger.info('prediction service started', { source: this.settings.source.type })
  }

  async stop(): Promise<void> {
    if (this.tick) clearInterval(this.tick)
    this.tick = null
    await this.sources.deactivate()
  }

  // --- Source handling -----------------------------------------------------

  private async activateSource(): Promise<void> {
    try {
      await this.sources.activate(this.settings.source)
    } catch (err) {
      logger.error('failed to activate source', { err: String(err) })
    }
  }

  /** Record an observed screenshot from any source (or manual entry). */
  recordManual(timestamp?: number): void {
    this.onScreenshot({
      timestamp: timestamp ?? Date.now(),
      source: this.settings.source.type as SourceType,
      detail: 'manual entry'
    })
  }

  private onScreenshot(event: ScreenshotEvent): void {
    this.engine.recordScreenshot(event)
    saveEvents(this.engine.getEvents())
    logger.event('screenshot detected', { source: event.source, ts: event.timestamp })

    this.notifications.notify(
      'screenshot-detected',
      'Screenshot detected',
      'A new screenshot event was recorded.'
    )
    this.windows.send('screenshot:detected', event)
    this.evaluateLearningMilestones()
    // Recompute immediately so the UI reacts without waiting for the next tick.
    this.onTick()
    this.pushAnalytics()
  }

  // --- Per-second loop -----------------------------------------------------

  private onTick(): void {
    const now = Date.now()
    const prediction = this.engine.getPrediction(now)

    this.windows.send('prediction:update', prediction)
    this.windows.send('status:badge', this.computeBadge())

    this.sampleConfidenceTrend(now, prediction.confidence)
    this.handleRiskTransitions(prediction.riskLevel)
    this.handleAutoHide(prediction, now)
  }

  private computeBadge(): StatusBadge {
    const stats = this.engine.getStats()
    if (stats.totalEvents === 0) return 'no-data'
    if (stats.isLearning) return 'learning'
    const confidence = this.engine.getPrediction().confidence
    if (confidence >= this.settings.prediction.confidenceThreshold) return 'high-confidence'
    return 'tracking'
  }

  private sampleConfidenceTrend(now: number, confidence: number): void {
    if (now - this.lastTrendSampleAt < TREND_SAMPLE_MS) return
    this.lastTrendSampleAt = now
    this.confidenceTrend.push({ timestamp: now, confidence })
    if (this.confidenceTrend.length > 500) this.confidenceTrend = this.confidenceTrend.slice(-500)
    saveConfidenceTrend(this.confidenceTrend)

    if (
      !this.crossedConfidenceThreshold &&
      confidence >= this.settings.prediction.confidenceThreshold &&
      !this.engine.getStats().isLearning
    ) {
      this.crossedConfidenceThreshold = true
      this.notifications.notify(
        'confidence-improved',
        'Confidence improved',
        `Prediction confidence reached ${Math.round(confidence * 100)}%.`
      )
    }
  }

  private handleRiskTransitions(level: RiskLevel): void {
    if (level === this.lastRiskLevel) return
    if (level === RiskLevel.HIGH) {
      this.notifications.notify('high-risk', 'High screenshot risk', 'A screenshot may be imminent.')
    } else if (level === RiskLevel.CRITICAL) {
      this.notifications.notify(
        'critical-risk',
        'Critical screenshot risk',
        'Estimated screenshot is very close. Prediction based — not guaranteed.'
      )
    }
    this.lastRiskLevel = level
  }

  private handleAutoHide(prediction: PredictionResult, now: number): void {
    const cfg = this.settings.autoHide
    if (!cfg.enabled) return
    if (now < this.autoHideSuppressedUntil) return

    // Fixed-interval mode: hide the moment we enter the lead window and stay
    // hidden until just after the estimated capture, so the widget is never in
    // the shot. The lead time (Settings → Prediction) controls how early.
    const fixedImminent =
      this.settings.prediction.algorithm === AlgorithmType.FIXED_INTERVAL &&
      prediction.imminent &&
      prediction.secondsRemaining != null
    if (fixedImminent) {
      const hideFor = prediction.secondsRemaining! + AUTOHIDE_POST_CAPTURE_S
      this.autoHideSuppressedUntil = now + hideFor * 1000 + AUTOHIDE_COOLDOWN_MS
      this.windows.autoHide(hideFor)
      return
    }

    // Learning modes: fall back to the risk-percentage threshold.
    if (prediction.riskPercentage >= cfg.threshold) {
      this.autoHideSuppressedUntil = now + cfg.durationSeconds * 1000 + AUTOHIDE_COOLDOWN_MS
      this.windows.autoHide(cfg.durationSeconds)
    }
  }

  private evaluateLearningMilestones(): void {
    const stats = this.engine.getStats()
    if (this.wasLearning && stats.totalEvents === 1) {
      this.notifications.notify(
        'learning-started',
        'Learning started',
        'Observing screenshot timing to build predictions.'
      )
    }
    if (this.wasLearning && !stats.isLearning) {
      this.wasLearning = false
      this.notifications.notify(
        'learning-completed',
        'Learning ready',
        'Enough data gathered — predictions are now active.'
      )
    }
  }

  // --- Settings ------------------------------------------------------------

  getSettings(): AppSettings {
    return this.settings
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const prev = this.settings
    this.settings = {
      general: { ...prev.general, ...patch.general },
      appearance: { ...prev.appearance, ...patch.appearance },
      prediction: { ...prev.prediction, ...patch.prediction },
      autoHide: { ...prev.autoHide, ...patch.autoHide },
      notifications: { ...prev.notifications, ...patch.notifications },
      source: { ...prev.source, ...patch.source },
      privacy: { ...prev.privacy, ...patch.privacy }
    }
    saveSettings(this.settings)

    this.applyEngineConfig()
    this.notifications.updateSettings(this.settings.notifications)
    this.windows.setAlwaysOnTop(this.settings.general.alwaysOnTop)
    this.windows.setOpacity(this.settings.appearance.opacity)
    this.windows.setContentProtection(this.settings.privacy.excludeFromCapture)

    // Reactivate the source if its configuration changed.
    if (JSON.stringify(prev.source) !== JSON.stringify(this.settings.source)) {
      await this.activateSource()
    }

    // Reflect interval/anchor edits in the countdown right away.
    this.onTick()
    this.windows.send('settings:changed', this.settings)
    return this.settings
  }

  async resetSettings(): Promise<AppSettings> {
    return this.updateSettings(DEFAULT_SETTINGS)
  }

  // --- Engine / source operations ------------------------------------------

  restartLearning(): void {
    this.engine.reset()
    this.confidenceTrend = []
    this.crossedConfidenceThreshold = false
    this.wasLearning = true
    this.lastRiskLevel = RiskLevel.SAFE
    saveEvents([])
    saveConfidenceTrend([])
    logger.info('learning restarted')
    this.onTick()
    this.pushAnalytics()
  }

  getPrediction() {
    return this.engine.getPrediction()
  }

  getHistory(): ScreenshotEvent[] {
    return this.engine.getEvents()
  }

  // --- Event history management --------------------------------------------

  deleteEvent(index: number): ScreenshotEvent[] {
    this.engine.deleteAt(index)
    this.persistAndRefresh()
    return this.engine.getEvents()
  }

  updateEvent(index: number, timestamp: number): ScreenshotEvent[] {
    this.engine.updateAt(index, timestamp)
    this.persistAndRefresh()
    return this.engine.getEvents()
  }

  /** Backfill a manual event at an arbitrary timestamp. */
  addEvent(timestamp: number): ScreenshotEvent[] {
    this.recordManual(timestamp)
    return this.engine.getEvents()
  }

  clearEvents(): ScreenshotEvent[] {
    this.engine.reset()
    this.persistAndRefresh()
    return this.engine.getEvents()
  }

  /** Persist current events and push fresh prediction + analytics to the UI. */
  private persistAndRefresh(): void {
    saveEvents(this.engine.getEvents())
    logger.event('event history mutated', { total: this.engine.getEvents().length })
    this.onTick()
    this.pushAnalytics()
  }

  getAnalytics(): AnalyticsData {
    return {
      stats: this.engine.getStats(),
      events: this.engine.getEvents(),
      confidenceTrend: this.confidenceTrend,
      prediction: this.engine.getPrediction()
    }
  }

  async verifySource(config: AppSettings['source']) {
    return this.sources.verify(config)
  }

  private pushAnalytics(): void {
    this.windows.send('analytics:update', this.getAnalytics())
  }
}

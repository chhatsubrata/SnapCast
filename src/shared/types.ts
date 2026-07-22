/**
 * Shared domain types.
 *
 * This module is imported by BOTH the Electron main process and the renderer,
 * so it must remain free of any runtime dependency on `electron`, the DOM or
 * Node APIs. Keep it to plain types and small pure enums/maps.
 *
 * Timestamps that cross the IPC boundary are serialized as epoch milliseconds
 * (`number`) rather than `Date`, because Electron's structured clone of `Date`
 * is reliable but numbers are unambiguous and trivially persistable.
 */

/** Risk severity buckets, ordered from least to most severe. */
export enum RiskLevel {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/** Where an observed screenshot event came from. */
export enum SourceType {
  MANUAL = 'manual',
  FILE_WATCHER = 'file-watcher',
  LOG_WATCHER = 'log-watcher',
  FUTURE = 'future'
}

/**
 * Prediction algorithm. Only fixed-interval is wired up for now; rolling-average
 * and weighted were removed and can be re-added here + in predictors.ts later.
 */
export enum AlgorithmType {
  FIXED_INTERVAL = 'fixed-interval'
}

export type ThemeMode = 'dark' | 'light' | 'system'

/** A single observed screenshot event (epoch ms timestamp). */
export interface ScreenshotEvent {
  /** Epoch milliseconds at which the screenshot was observed. */
  timestamp: number
  source: SourceType
  /** Optional opaque detail (e.g. file path or matched log line). */
  detail?: string
}

/** Output of the prediction engine. */
export interface PredictionResult {
  /** Epoch ms of the next estimated screenshot, or null when no data. */
  nextEstimatedScreenshot: number | null
  /** 0..1 confidence in the estimate. */
  confidence: number
  /** 0..100 probability that a screenshot is imminent. */
  riskPercentage: number
  riskLevel: RiskLevel
  /** Seconds until the next estimated screenshot (>= 0), or null. */
  secondsRemaining: number | null
  /** 0..1 fraction of the current predicted interval already elapsed. */
  intervalProgress: number
  /**
   * True when the next screenshot is within the configured lead window — the
   * widget switches to its strong "about to capture" highlight. Driven by the
   * lead time, independent of the confidence-based risk bucket.
   */
  imminent: boolean
  /** Which algorithm produced this result. */
  algorithm: AlgorithmType
}

/** Aggregate statistics derived from observed intervals (ms). */
export interface LearningStats {
  totalEvents: number
  averageInterval: number | null
  medianInterval: number | null
  minInterval: number | null
  maxInterval: number | null
  standardDeviation: number | null
  lastScreenshot: number | null
  /** Whether enough data has been gathered for confident predictions. */
  isLearning: boolean
}

export type WidgetMode = 'expanded' | 'compact'

export type StatusBadge = 'learning' | 'tracking' | 'high-confidence' | 'no-data'

export interface GeneralSettings {
  launchOnStartup: boolean
  alwaysOnTop: boolean
  compactModeDefault: boolean
  /**
   * When true, the widget's X button fully quits the app instead of hiding it to
   * the tray. When false (default) the app keeps running in the tray.
   */
  quitOnClose: boolean
  /**
   * When true, closing via the X button stops the stopwatch and clears the
   * fixed-interval sync anchor (resets the timer) while leaving every other
   * setting untouched.
   */
  resetTimerOnClose: boolean
}

export interface AppearanceSettings {
  theme: ThemeMode
  /** Window opacity 0.3..1. */
  opacity: number
  /** Widget scale multiplier 0.8..1.5. */
  widgetScale: number
  /**
   * Desktop pet rotation. Off: one mascot per weekday (Sunday keeps the cat).
   * On: the cast takes turns, changing every hour and wrapping back to the first
   * once everyone has had a shift. While the timer runs the shifts are counted
   * from the start of the session; otherwise they follow the clock hour.
   */
  hourlyMascots: boolean
  /**
   * Sprite id the user picked as the current mascot. The rotation carries on
   * from there, one mascot per hour. `null` follows the clock hour instead.
   */
  mascotStart: string | null
  /** When {@link mascotStart} was picked (epoch ms); the hour count runs from here. */
  mascotAnchor: number
}

export interface PredictionSettings {
  algorithm: AlgorithmType
  /** 0..1 minimum confidence before predictions are surfaced as reliable. */
  confidenceThreshold: number
  /**
   * User-set fixed cadence in seconds. Used as the predicted interval when
   * `algorithm === FIXED_INTERVAL`, so the countdown works for a strict-timer
   * tracker (e.g. Top Tracker every 10 min) even with no observed events yet.
   */
  fixedIntervalSeconds: number
  /**
   * Seconds before the next estimated capture to flip the widget into its
   * "imminent" highlight, giving the user time to switch tabs. Visual only.
   */
  leadSeconds: number
  /**
   * Phase anchor (epoch ms) for the fixed-interval cycle, set by the widget's
   * "Sync" button. `null` means rely solely on observed screenshot events.
   */
  anchorTimestamp: number | null
}

export interface AutoHideSettings {
  enabled: boolean
  /** Risk percentage threshold (90 | 95 | 98 typically). */
  threshold: number
  /** Re-show delay in seconds (5 | 10 | 15 | 20). */
  durationSeconds: number
}

export interface NotificationSettings {
  enabled: boolean
  soundsEnabled: boolean
}

/**
 * Live stopwatch state pushed from main to the renderer every second.
 *
 * The widget counts UP from 00:00 when running. Keeping the widget out of an
 * external tracker's screenshots is handled deterministically by OS capture
 * exclusion (see {@link PrivacySettings}), not by timing — so the stopwatch
 * carries no interval/hide information.
 */
export interface TimerState {
  running: boolean
  /** Seconds elapsed since Start (0 when stopped). */
  elapsedSeconds: number
}

/**
 * Screenshot privacy.
 *
 * `excludeFromCapture` toggles `BrowserWindow.setContentProtection`, which asks
 * the OS compositor to omit the widget from screen captures and recordings
 * (Windows 10 2004+ and macOS). On Linux it is a no-op; the global hotkey
 * (Ctrl/Cmd+Shift+H) is the manual fallback there.
 */
export interface PrivacySettings {
  excludeFromCapture: boolean
}

export interface SourceConfig {
  type: SourceType
  /** Folder to watch (file-watcher) or log file path (log-watcher). */
  path?: string
  /** Regex used to match screenshot lines for the log watcher. */
  logPattern?: string
}

export interface AppSettings {
  general: GeneralSettings
  appearance: AppearanceSettings
  prediction: PredictionSettings
  autoHide: AutoHideSettings
  notifications: NotificationSettings
  source: SourceConfig
  privacy: PrivacySettings
}

/** A confidence sample recorded over time for the trend chart. */
export interface ConfidenceSample {
  timestamp: number
  confidence: number
}

/** Snapshot consumed by the analytics dashboard. */
export interface AnalyticsData {
  stats: LearningStats
  events: ScreenshotEvent[]
  confidenceTrend: ConfidenceSample[]
  prediction: PredictionResult
}

/** Default settings used on first launch and when persisted data is corrupt. */
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    launchOnStartup: false,
    alwaysOnTop: true,
    // The widget opens as a small timer box by default; click it to expand.
    compactModeDefault: true,
    // X hides to tray by default, but resets the timer on the way out.
    quitOnClose: false,
    resetTimerOnClose: true
  },
  appearance: {
    theme: 'system',
    opacity: 0.95,
    widgetScale: 1,
    hourlyMascots: false,
    mascotStart: null,
    mascotAnchor: 0
  },
  prediction: {
    algorithm: AlgorithmType.FIXED_INTERVAL,
    confidenceThreshold: 0.6,
    fixedIntervalSeconds: 600,
    leadSeconds: 30,
    anchorTimestamp: null
  },
  autoHide: {
    enabled: false,
    threshold: 95,
    durationSeconds: 15
  },
  notifications: {
    enabled: true,
    soundsEnabled: true
  },
  source: {
    type: SourceType.MANUAL,
    logPattern: '(screenshot|screen[_-]?shot|capture)'
  },
  privacy: {
    excludeFromCapture: true
  }
}

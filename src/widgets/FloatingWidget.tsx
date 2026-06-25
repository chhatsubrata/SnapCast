/**
 * The floating overlay widget — a screenshot countdown.
 *
 * Two surfaces, switched by mode:
 *   - Compact: a small box showing the time until the next predicted screenshot
 *     and a progress ring. Click it to expand; drag it by the grip handle.
 *   - Expanded: the full panel with a large countdown ring, a "Sync" control to
 *     anchor a fixed-interval cycle, and the configured interval.
 *
 * The countdown is fed by the prediction engine via the `prediction:update` push
 * (1 Hz). In the final `leadSeconds` before a capture the face flips to a strong
 * red highlight (`prediction.imminent`) so the user can switch tabs in time.
 *
 * The widget is kept out of an external tracker's screenshots deterministically
 * by OS capture exclusion (Settings → Screenshot Privacy), not by timing. The
 * global hotkey Ctrl/Cmd+Shift+H toggles visibility as a manual fallback.
 */

import { memo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  GripVertical,
  RefreshCw,
  Settings,
  Shield,
  ShieldOff,
  Shrink,
  Timer,
  TimerReset,
  X
} from 'lucide-react'
import { AlgorithmType, RiskLevel, type PredictionResult } from '@shared/types'
import { usePredictionStore } from '@store/predictionStore'
import { useSettingsStore } from '@store/settingsStore'
import { useTimerStore } from '@store/timerStore'
import { useWidgetStore } from '@store/widgetStore'
import { Countdown } from '@components/Countdown'
import { ProgressRing } from '@components/ProgressRing'
import { CatWalker } from '@components/CatWalker'
import { IconButton } from '@components/IconButton'
import { RISK_THEME } from '@utils/risk'
import appIcon from '../assets/app-icon.png'

const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

const restShadow = '0 4px 16px rgba(0,0,0,0.12)'

/** The risk we actually paint: an imminent capture always shows the strongest state. */
function effectiveRisk(prediction: PredictionResult): RiskLevel {
  return prediction.imminent ? RiskLevel.CRITICAL : prediction.riskLevel
}

/** Resting glow for a risk level, mirroring AlertShell's visual language. */
function riskGlow(level: RiskLevel): string {
  if (level === RiskLevel.SAFE) return restShadow
  const accent = RISK_THEME[level].accent
  return `0 0 0 1px ${accent}55, 0 0 26px ${accent}66`
}

/** Framer-motion animate/transition pair: pulses while a capture is imminent. */
function glowMotion(prediction: PredictionResult): {
  animate: { boxShadow: string | string[] }
  transition: object
} {
  const level = effectiveRisk(prediction)
  const glow = riskGlow(level)
  if (!prediction.imminent) {
    return { animate: { boxShadow: glow }, transition: { duration: 0.4 } }
  }
  const accent = RISK_THEME[RiskLevel.CRITICAL].accent
  return {
    animate: { boxShadow: [glow, `0 0 0 4px ${accent}44, 0 0 44px ${accent}99`, glow] },
    transition: { duration: 1, repeat: Infinity, ease: 'easeInOut' }
  }
}

/**
 * Neutral label for the always-visible compact face. Disguised as a generic
 * focus timer so the widget's purpose isn't obvious if it ever appears in a
 * screenshot. The risk colour still cues the worker; the wording gives nothing
 * away to a client.
 */
function compactLabel(prediction: PredictionResult): string {
  if (prediction.secondsRemaining === null) return 'Focus timer'
  if (prediction.imminent) return 'Break now'
  switch (prediction.riskLevel) {
    case RiskLevel.CRITICAL:
      return 'Break now'
    case RiskLevel.HIGH:
      return 'Break soon'
    case RiskLevel.WARNING:
      return 'Almost there'
    default:
      return 'Focus session'
  }
}

function FloatingWidgetBase(): React.JSX.Element {
  const mode = useWidgetStore((s) => s.mode)

  return (
    <div className="h-screen w-screen px-2 pb-2 pt-1">
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'expanded' ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <ExpandedView />
          </motion.div>
        ) : (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <CompactView />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- Compact ---------------------------------------------------------------

const CompactView = memo(function CompactView(): React.JSX.Element {
  const prediction = usePredictionStore((s) => s.prediction)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const setMode = useWidgetStore((s) => s.setMode)
  const expand = useCallback(() => setMode('expanded'), [setMode])

  const isFixed = settings.prediction.algorithm === AlgorithmType.FIXED_INTERVAL
  const sync = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      void update({ prediction: { ...settings.prediction, anchorTimestamp: Date.now() } })
    },
    [update, settings.prediction]
  )

  const level = effectiveRisk(prediction)
  const theme = RISK_THEME[level]
  const dotColor = theme.accent
  const isSafe = level === RiskLevel.SAFE
  const { animate, transition } = glowMotion(prediction)

  return (
    <div className="flex h-full w-full flex-col gap-1">
      {/* Desktop-pet lane: a pixel cat strolls along the top of the bar. */}
      <div className="h-8 shrink-0 px-1">
        <CatWalker imminent={prediction.imminent} risk={prediction.riskLevel} />
      </div>

      <motion.button
        type="button"
        onClick={expand}
        aria-label="Expand widget"
        title="Click to expand"
        className="group flex min-h-0 w-full flex-1 items-center gap-2 py-2 rounded-2xl border px-2.5 text-left"
      style={{
        ...noDrag,
        // Background + border tint with proximity: calm surface when SAFE, the
        // risk colour as a screenshot approaches (matches the glow + label).
        background: isSafe ? 'var(--color-app-surface)' : theme.tint,
        borderColor: isSafe ? 'var(--color-app-border)' : theme.accent,
        opacity: 'var(--app-opacity, 1)'
      }}
      animate={animate}
      transition={transition}
    >
      <span
        className="flex h-full cursor-grab items-center text-[var(--color-app-muted)] opacity-50 hover:opacity-100 active:cursor-grabbing"
        style={{ ...drag, color: isSafe ? undefined : theme.accent }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={20}  />
      </span>

      <ProgressRing progress={prediction.intervalProgress} size={44} strokeWidth={4} />

      <div className="flex min-w-0 flex-col leading-tight">
        <Countdown
          seconds={prediction.secondsRemaining}
          className="text-2xl"
          style={{ color: isSafe ? 'var(--color-app-timer)' : theme.accent }}
        />
        <span
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: dotColor }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
          {compactLabel(prediction)}
        </span>
      </div>

      {isFixed && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Sync cycle now"
          title="Sync cycle now"
          onClick={sync}
          className="ml-auto flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--color-app-muted)] transition-colors hover:bg-black/10 hover:text-[var(--color-app-text)] dark:hover:bg-white/10"
          style={{ ...noDrag, color: isSafe ? undefined : theme.accent }}
        >
          <RefreshCw size={20} />
        </span>
      )}
      </motion.button>
    </div>
  )
})

// --- Expanded --------------------------------------------------------------

const ExpandedView = memo(function ExpandedView(): React.JSX.Element {
  const prediction = usePredictionStore((s) => s.prediction)
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const setMode = useWidgetStore((s) => s.setMode)
  const setView = useWidgetStore((s) => s.setView)

  const excludeFromCapture = settings.privacy.excludeFromCapture
  const isFixed = settings.prediction.algorithm === AlgorithmType.FIXED_INTERVAL
  const intervalMinutes = Math.round(settings.prediction.fixedIntervalSeconds / 60)

  const level = effectiveRisk(prediction)
  const dotColor = RISK_THEME[level].accent
  const isSafe = level === RiskLevel.SAFE
  const { animate, transition } = glowMotion(prediction)

  const sync = useCallback(() => {
    void update({
      prediction: { ...settings.prediction, anchorTimestamp: Date.now() }
    })
  }, [update, settings.prediction])

  // Stop & Reset: halt the stopwatch and clear the sync anchor so the cycle
  // restarts cleanly (settings are left untouched).
  const stopAndReset = useCallback(() => {
    void useTimerStore.getState().stop()
    void update({ prediction: { ...settings.prediction, anchorTimestamp: null } })
  }, [update, settings.prediction])

  return (
    <motion.div
      className="flex h-full flex-col overflow-hidden rounded-3xl border"
      style={{
        background: 'var(--color-app-surface)',
        borderColor: 'var(--color-app-border)',
        color: 'var(--color-app-text)',
        opacity: 'var(--app-opacity, 1)'
      }}
      animate={animate}
      transition={transition}
    >
      {/* Header (draggable) */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1" style={drag}>
        <div className="flex items-center gap-2">
          <img
            src={appIcon}
            alt=""
            aria-hidden
            className="h-7 w-7 rounded-lg"
            draggable={false}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-app-primary)' }}>
            Shot Capture
          </span>
        </div>
        <div className="flex items-center gap-0.5" style={noDrag}>
          <IconButton icon={Settings} label="Settings" onClick={() => setView('settings')} />
          <IconButton icon={Shrink} label="Collapse" onClick={() => setMode('compact')} />
          <IconButton icon={X} label="Close" onClick={() => void window.api.invoke('window:close')} />
        </div>
      </div>

      {/* Ring + countdown */}
      <div className="flex flex-col items-center pt-4">
        <ProgressRing progress={prediction.intervalProgress} size={196} strokeWidth={6}>
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'var(--color-app-muted)' }}
          >
            Next screenshot
          </span>
          <Countdown
            seconds={prediction.secondsRemaining}
            className="my-0.5 text-[2.75rem]"
            style={{ color: isSafe ? 'var(--color-app-timer)' : dotColor }}
          />
          <span
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: dotColor }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
            {compactLabel(prediction)}
          </span>
        </ProgressRing>
      </div>

      {/* Sync + interval (fixed-interval mode) */}
      <div className="mt-auto px-4 pb-4 pt-5" style={noDrag}>
        {isFixed ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sync}
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold transition-transform active:scale-[0.98]"
                style={{ background: 'var(--color-app-primary)', color: 'var(--color-on-primary)' }}
              >
                <Timer size={16} /> Sync cycle now
              </button>
              <button
                type="button"
                onClick={stopAndReset}
                title="Stop the timer and reset the cycle"
                className="flex items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-semibold transition-transform active:scale-[0.98]"
                style={{
                  borderColor: 'var(--color-app-border)',
                  background: 'var(--color-app-surface-2)',
                  color: 'var(--color-app-text)'
                }}
              >
                <TimerReset size={14} /> Stop &amp; Reset
              </button>
            </div>
            <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--color-app-muted)' }}>
              {intervalMinutes}-minute interval
              {settings.prediction.anchorTimestamp
                ? ` · synced ${new Date(settings.prediction.anchorTimestamp).toLocaleTimeString()}`
                : ' · press Sync when the tracker starts'}
            </p>
          </>
        ) : (
          <p className="text-center text-[11px]" style={{ color: 'var(--color-app-muted)' }}>
            Learning cadence from observed screenshots. Switch to Fixed Interval in Settings for a
            strict-timer tracker.
          </p>
        )}

        {/* Capture-exclusion status */}
        <div
          className="mt-3 flex items-center justify-center gap-1.5 text-[11px]"
          style={{ color: excludeFromCapture ? '#34d399' : 'var(--color-app-muted)' }}
        >
          {excludeFromCapture ? <Shield size={13} /> : <ShieldOff size={13} />}
          {excludeFromCapture ? 'Hidden from screen capture' : 'Visible in screenshots'}
        </div>
        <p className="mt-1 text-center text-[10px]" style={{ color: 'var(--color-app-muted)' }}>
          Press Ctrl/⌘ + Shift + H to hide instantly.
        </p>
      </div>
    </motion.div>
  )
})

export const FloatingWidget = memo(FloatingWidgetBase)

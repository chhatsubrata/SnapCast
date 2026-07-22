/**
 * Manual countdown entry: type how many minutes are left and the fixed-interval
 * cycle is re-phased to match (main solves for the anchor — see
 * `@shared/engine/fixed-interval`).
 *
 * Validated as you type against the same rule main enforces: the entry can never
 * exceed the interval, because the countdown never starts higher than one whole
 * cycle. An invalid entry marks the field and disables Set.
 *
 * Used both under the big countdown in the expanded widget and in Settings, so
 * the two can't drift apart.
 */

import { memo, useState } from 'react'
import { checkRemainingSeconds } from '@shared/engine/fixed-interval'

interface RemainingInputProps {
  intervalSeconds: number
  /** `widget` is the tighter, centred treatment used under the countdown ring. */
  variant?: 'widget' | 'settings'
}

function RemainingInputBase({
  intervalSeconds,
  variant = 'settings'
}: RemainingInputProps): React.JSX.Element {
  const [draft, setDraft] = useState('')
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const seconds = Number(draft) * 60
  const check = checkRemainingSeconds(seconds, intervalSeconds)
  const empty = draft.trim() === ''
  // Only complain once there is something to judge.
  const error = empty ? null : check.message
  const intervalMinutes = Math.round(intervalSeconds / 60)

  const apply = async (): Promise<void> => {
    const outcome = await window.api.invoke('prediction:set-remaining', { seconds })
    setResult(outcome)
    if (outcome.ok) setDraft('')
  }

  const widget = variant === 'widget'

  return (
    <div className={widget ? 'space-y-1' : 'space-y-1.5'}>
      <div
        className={
          widget
            ? 'flex items-center justify-center gap-2'
            : 'flex items-center justify-between gap-3 text-sm'
        }
      >
        <span
          className={widget ? 'text-[11px]' : 'text-[12.5px]'}
          style={widget ? { color: 'var(--color-app-muted)' } : undefined}
        >
          {widget ? 'Time left' : 'Set remaining time'}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={intervalMinutes}
            step={0.5}
            value={draft}
            placeholder="min"
            aria-label="Minutes until the next screenshot"
            onChange={(e) => {
              setDraft(e.target.value)
              setResult(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !empty && check.ok) void apply()
            }}
            className={`rounded-lg border px-2.5 text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-app-primary) ${
              widget ? 'w-16 py-1 text-[13px]' : 'w-20 py-1.5 text-sm'
            }`}
            style={{
              background: 'var(--color-app-surface)',
              borderColor: error ? '#ef4444' : 'var(--color-app-border)',
              color: 'var(--color-app-text)'
            }}
          />
          <button
            type="button"
            disabled={empty || !check.ok}
            onClick={() => void apply()}
            className={`rounded-lg font-semibold transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
              widget ? 'px-2.5 py-1 text-[13px]' : 'px-3 py-1.5 text-sm'
            }`}
            style={{ background: 'var(--color-app-primary)', color: 'var(--color-on-primary)' }}
          >
            Set
          </button>
        </div>
      </div>
      <p
        className={widget ? 'text-center text-[10px]' : 'text-[12px]'}
        style={{ color: error ? '#ef4444' : 'var(--color-app-muted)' }}
      >
        {error ??
          result?.message ??
          (widget
            ? `Minutes left, up to ${intervalMinutes}`
            : `Minutes until the next screenshot — up to the ${intervalMinutes}-minute interval.`)}
      </p>
    </div>
  )
}

export const RemainingInput = memo(RemainingInputBase)

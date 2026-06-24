/**
 * Plain timer readout. Renders the formatted time with tabular figures so the
 * digits don't shift width as they change — no per-tick animation.
 */

import { memo } from 'react'
import { formatCountdown } from '@utils/format'

interface CountdownProps {
  seconds: number | null
  className?: string
  style?: React.CSSProperties
}

function CountdownBase({ seconds, className = '', style }: CountdownProps): React.JSX.Element {
  return (
    <span
      className={`inline-block font-semibold tabular-nums tracking-tight ${className}`}
      style={style}
      aria-live="off"
    >
      {formatCountdown(seconds)}
    </span>
  )
}

export const Countdown = memo(CountdownBase)

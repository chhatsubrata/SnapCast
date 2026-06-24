/**
 * Animated circular progress ring. The arc length encodes how far through the
 * current interval we are; the stroke colour glides green -> yellow -> orange ->
 * red via {@link ringColor}. The centre renders arbitrary children (the
 * countdown). Memoised: only re-renders when `progress`/`size` change.
 */

import { memo } from 'react'
import { motion } from 'framer-motion'
import { ringColor } from '@utils/risk'

interface ProgressRingProps {
  /** 0..1 fraction of the interval elapsed. */
  progress: number
  size?: number
  strokeWidth?: number
  children?: React.ReactNode
}

function ProgressRingBase({
  progress,
  size = 160,
  strokeWidth = 12,
  children
}: ProgressRingProps): React.JSX.Element {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, progress))
  const offset = circumference * (1 - clamped)
  const color = ringColor(clamped)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-black/10 dark:stroke-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset, stroke: color }}
          transition={{ strokeDashoffset: { duration: 0.9, ease: 'linear' }, stroke: { duration: 0.5 } }}
          style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export const ProgressRing = memo(ProgressRingBase)

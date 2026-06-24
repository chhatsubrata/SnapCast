/**
 * Glassmorphism container whose border, glow and pulse intensity track the
 * current risk level (the Visual Alert System):
 *   SAFE     - calm, no animation
 *   WARNING  - soft glow + gentle pulse
 *   HIGH     - orange border + strong pulse
 *   CRITICAL - red glow + ring pulse
 */

import { memo } from 'react'
import { motion } from 'framer-motion'
import { RiskLevel } from '@shared/types'
import { RISK_THEME } from '@utils/risk'

interface AlertShellProps {
  riskLevel: RiskLevel
  children: React.ReactNode
  className?: string
  /** App is draggable by this shell unless a child opts out with .no-drag. */
  draggable?: boolean
}

function AlertShellBase({
  riskLevel,
  children,
  className = '',
  draggable = true
}: AlertShellProps): React.JSX.Element {
  const theme = RISK_THEME[riskLevel]

  const glow =
    riskLevel === RiskLevel.SAFE
      ? '0 8px 32px rgba(0,0,0,0.35)'
      : `0 0 0 1px ${theme.accent}55, 0 0 24px ${theme.accent}55, 0 8px 32px rgba(0,0,0,0.4)`

  const pulse =
    riskLevel === RiskLevel.CRITICAL
      ? { boxShadow: [glow, `0 0 0 4px ${theme.accent}33, 0 0 40px ${theme.accent}88`, glow] }
      : riskLevel === RiskLevel.HIGH
        ? { boxShadow: [glow, `0 0 0 2px ${theme.accent}55, 0 0 30px ${theme.accent}77`, glow] }
        : riskLevel === RiskLevel.WARNING
          ? { boxShadow: [glow, `0 0 18px ${theme.accent}55`, glow] }
          : { boxShadow: glow }

  const animating = riskLevel !== RiskLevel.SAFE

  return (
    <motion.div
      className={`relative overflow-hidden rounded-3xl border border-white/15 bg-white/70 backdrop-blur-2xl dark:bg-zinc-900/60 ${className}`}
      style={{
        WebkitAppRegion: draggable ? 'drag' : 'no-drag',
        opacity: 'var(--app-opacity, 1)'
      } as React.CSSProperties}
      animate={pulse}
      transition={{
        duration: riskLevel === RiskLevel.CRITICAL ? 1 : 2,
        repeat: animating ? Infinity : 0,
        ease: 'easeInOut'
      }}
    >
      {children}
    </motion.div>
  )
}

export const AlertShell = memo(AlertShellBase)

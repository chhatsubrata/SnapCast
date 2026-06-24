/**
 * Pill showing the current risk level with its themed colour. Pulses gently at
 * HIGH and more insistently at CRITICAL.
 */

import { memo } from 'react'
import { motion } from 'framer-motion'
import { RiskLevel } from '@shared/types'
import { RISK_THEME } from '@utils/risk'

interface RiskBadgeProps {
  riskLevel: RiskLevel
  compact?: boolean
}

function RiskBadgeBase({ riskLevel, compact = false }: RiskBadgeProps): React.JSX.Element {
  const theme = RISK_THEME[riskLevel]
  const pulsing = riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL
  const fast = riskLevel === RiskLevel.CRITICAL

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${theme.text} ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
      style={{ backgroundColor: theme.tint }}
      animate={pulsing ? { opacity: [1, 0.6, 1] } : { opacity: 1 }}
      transition={{ duration: fast ? 0.8 : 1.6, repeat: pulsing ? Infinity : 0 }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: theme.accent }} />
      {theme.label}
    </motion.span>
  )
}

export const RiskBadge = memo(RiskBadgeBase)

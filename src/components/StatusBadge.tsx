/**
 * Small status chip reflecting the learning lifecycle:
 *   🟡 Learning · 🟢 Tracking · 🔵 High Confidence · ⚪ No Data
 */

import { memo } from 'react'
import type { StatusBadge as StatusBadgeKind } from '@shared/types'

const MAP: Record<StatusBadgeKind, { dot: string; label: string; text: string }> = {
  learning: { dot: 'bg-yellow-400', label: 'Learning', text: 'text-yellow-300' },
  tracking: { dot: 'bg-emerald-400', label: 'Tracking', text: 'text-emerald-300' },
  'high-confidence': { dot: 'bg-sky-400', label: 'High Confidence', text: 'text-sky-300' },
  'no-data': { dot: 'bg-zinc-400', label: 'No Data', text: 'text-zinc-300' }
}

interface StatusBadgeProps {
  status: StatusBadgeKind
}

function StatusBadgeBase({ status }: StatusBadgeProps): React.JSX.Element {
  const cfg = MAP[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${cfg.text}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export const StatusBadge = memo(StatusBadgeBase)

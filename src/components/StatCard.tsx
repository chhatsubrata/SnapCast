/**
 * Compact labelled statistic used on the analytics dashboard and widget detail
 * rows.
 */

import { memo } from 'react'

interface StatCardProps {
  label: string
  value: string
  hint?: string
  accent?: string
}

function StatCardBase({ label, value, hint, accent }: StatCardProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/10 bg-white/40 p-3 dark:bg-white/5">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-zinc-400">{hint}</div>}
    </div>
  )
}

export const StatCard = memo(StatCardBase)

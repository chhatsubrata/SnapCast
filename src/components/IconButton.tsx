/**
 * Small icon button used in the title bar and toolbars. Always opts out of the
 * window drag region so clicks register, and is keyboard-focusable for a11y.
 */

import { memo } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  active?: boolean
  className?: string
}

function IconButtonBase({
  icon: Icon,
  label,
  onClick,
  active = false,
  className = ''
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`no-drag inline-flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-black/10 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white ${
        active ? 'bg-black/10 text-zinc-900 dark:bg-white/10 dark:text-white' : ''
      } ${className}`}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  )
}

export const IconButton = memo(IconButtonBase)

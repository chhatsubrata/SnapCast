/**
 * Full-window scrollable shell used by the Analytics, Settings and Wizard
 * pages. Provides the draggable header, a back button to the widget, and a
 * glassmorphism panel body.
 */

import { memo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useWidgetStore } from '@store/widgetStore'

interface PageShellProps {
  title: string
  children: React.ReactNode
  actions?: React.ReactNode
}

function PageShellBase({ title, children, actions }: PageShellProps): React.JSX.Element {
  const setView = useWidgetStore((s) => s.setView)

  return (
    <div className="h-screen w-screen p-2">
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl"
        style={{
          background: 'var(--color-app-bg)',
          color: 'var(--color-app-text)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)'
        }}
      >
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={
          {
            WebkitAppRegion: 'drag',
            borderColor: 'var(--color-app-border)'
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView('widget')}
            aria-label="Back to widget"
            className="no-drag inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-white/10"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-sm font-semibold">{title}</h1>
        </div>
        <div className="no-drag flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {actions}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  )
}

export const PageShell = memo(PageShellBase)

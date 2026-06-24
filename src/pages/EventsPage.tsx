/**
 * Event history manager. Lists every recorded screenshot event (newest first)
 * and lets the user add, edit the timestamp of, delete, or clear events. All
 * mutations go through the typed `events:*` IPC channels; the main process
 * persists, recomputes the prediction, and returns the fresh list.
 *
 * Indices passed to the IPC layer refer to the ascending-sorted array the main
 * process holds, so we keep that ordering internally and only reverse for
 * display.
 */

import { memo, useCallback, useEffect, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { ScreenshotEvent } from '@shared/types'
import { PageShell } from '@components/PageShell'
import { formatDuration } from '@utils/format'

/** epoch ms -> value for <input type="datetime-local"> in LOCAL time, second precision. */
function toLocalInput(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

function fromLocalInput(value: string): number | null {
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function EventsPageBase(): React.JSX.Element {
  const [events, setEvents] = useState<ScreenshotEvent[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [addValue, setAddValue] = useState('')

  const refresh = useCallback(async () => {
    setEvents(await window.api.invoke('events:list'))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startEdit = (index: number, ts: number): void => {
    setEditing(index)
    setEditValue(toLocalInput(ts))
  }

  const saveEdit = async (index: number): Promise<void> => {
    const ts = fromLocalInput(editValue)
    if (ts === null) return
    setEvents(await window.api.invoke('events:update', { index, timestamp: ts }))
    setEditing(null)
  }

  const remove = async (index: number): Promise<void> => {
    setEvents(await window.api.invoke('events:delete', index))
  }

  const add = async (): Promise<void> => {
    const ts = addValue ? fromLocalInput(addValue) : Date.now()
    if (ts === null) return
    setEvents(await window.api.invoke('events:add', ts))
    setAddValue('')
  }

  const clearAll = async (): Promise<void> => {
    if (!window.confirm('Delete ALL recorded events? This cannot be undone.')) return
    setEvents(await window.api.invoke('events:clear'))
  }

  // Display newest first while preserving the real (ascending) index for IPC.
  const rows = events.map((event, index) => ({ event, index })).reverse()

  return (
    <PageShell
      title="Event History"
      actions={
        events.length > 0 ? (
          <button
            type="button"
            onClick={() => void clearAll()}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
          >
            <Trash2 size={13} /> Clear all
          </button>
        ) : null
      }
    >
      <div className="mx-auto max-w-md space-y-4">
        {/* Add event */}
        <div
          className="rounded-2xl border p-3"
          style={{ background: 'var(--color-app-surface-2)', borderColor: 'var(--color-app-border)' }}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-app-muted)' }}>
            Add event
          </div>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              step={1}
              value={addValue}
              onChange={(e) => setAddValue(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm"
              style={{
                background: 'var(--color-app-surface)',
                borderColor: 'var(--color-app-border)',
                color: 'var(--color-app-text)'
              }}
            />
            <button
              type="button"
              onClick={() => void add()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold"
              style={{ background: 'var(--color-app-primary)', color: 'var(--color-on-primary)' }}
            >
              <Plus size={15} /> Add
            </button>
          </div>
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-app-muted)' }}>
            Leave blank to add at the current time.
          </p>
        </div>

        {/* List */}
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: 'var(--color-app-muted)' }}>
            No events recorded yet. Add one above, or use Record screenshot on the widget.
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map(({ event, index }, displayPos) => {
              // Interval to the previous (older) event for context.
              const prev = events[index - 1]
              const gap = prev ? formatDuration(event.timestamp - prev.timestamp) : '—'
              const isEditing = editing === index
              return (
                <li
                  key={`${event.timestamp}-${index}`}
                  className="rounded-xl border p-3"
                  style={{ background: 'var(--color-app-surface-2)', borderColor: 'var(--color-app-border)' }}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        step={1}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-sm"
                        style={{
                          background: 'var(--color-app-surface)',
                          borderColor: 'var(--color-app-border)',
                          color: 'var(--color-app-text)'
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Save"
                        onClick={() => void saveEdit(index)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel"
                        onClick={() => setEditing(null)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                        style={{ color: 'var(--color-app-muted)' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--color-app-muted)' }}>
                          #{rows.length - displayPos} · {event.source} · +{gap} since previous
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Edit time"
                          onClick={() => startEdit(index, event.timestamp)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
                          style={{ color: 'var(--color-app-muted)' }}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete"
                          onClick={() => void remove(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PageShell>
  )
}

export const EventsPage = memo(EventsPageBase)

/**
 * Pointer-driven window dragging.
 *
 * The widget is frameless, so it used to be moved with `-webkit-app-region: drag`.
 * That relies on the window manager honouring a move request (several Linux WMs
 * do not for overlay-style windows) and it hit-tests badly inside framer-motion's
 * composited layers — both of which left the widget un-draggable.
 *
 * Instead we drive the move ourselves: anchor on pointer-down, then push the
 * pointer's screen position to main on every move (coalesced to one IPC per
 * animation frame) and let the window manager stay out of it.
 *
 * Spread the returned props onto any element that should act as a drag handle.
 */

import { useCallback, useEffect, useRef } from 'react'

interface DragHandleProps {
  onPointerDown: (e: React.PointerEvent) => void
  style: React.CSSProperties
}

export function useWindowDrag(): DragHandleProps {
  // Latest pointer position awaiting a frame, and the pending frame handle.
  const pending = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    []
  )

  const flush = useCallback(() => {
    frame.current = null
    const p = pending.current
    if (!p) return
    pending.current = null
    void window.api.invoke('window:drag-move', p)
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Left button only; ignore the resize-edge/secondary cases.
      if (e.button !== 0) return
      // Controls inside a handle (title-bar buttons) opt out via `.no-drag`.
      if ((e.target as HTMLElement).closest('.no-drag')) return
      e.preventDefault()

      const target = e.currentTarget as HTMLElement
      target.setPointerCapture(e.pointerId)
      void window.api.invoke('window:drag-start', { x: e.screenX, y: e.screenY })

      const move = (ev: PointerEvent): void => {
        pending.current = { x: ev.screenX, y: ev.screenY }
        if (frame.current === null) frame.current = requestAnimationFrame(flush)
      }
      const up = (): void => {
        target.releasePointerCapture?.(e.pointerId)
        target.removeEventListener('pointermove', move)
        target.removeEventListener('pointerup', up)
        target.removeEventListener('pointercancel', up)
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current)
          frame.current = null
        }
        // Deliver the final position so the window lands exactly under the cursor.
        flush()
      }

      target.addEventListener('pointermove', move)
      target.addEventListener('pointerup', up)
      target.addEventListener('pointercancel', up)
    },
    [flush]
  )

  return {
    onPointerDown,
    // Grab cursor + no text selection while dragging the handle.
    style: { cursor: 'grab', userSelect: 'none', WebkitUserSelect: 'none' }
  }
}

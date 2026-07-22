/**
 * Pixel speech bubble for the desktop pet.
 *
 * Drawn as DOM (not inside the sprite's SVG) so the copy stays readable, but
 * styled to match the retro grid: hard edges, a stepped border built from
 * box-shadows instead of a radius, a three-block tail, and a typewriter reveal.
 *
 * It opens *downward* over the widget body — the compact window is only ~132px
 * tall, so a bubble above the pet lane would be clipped by the OS window — and
 * is pointer-transparent so it can never swallow a click on the widget beneath.
 */

import { memo, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const WIDTH = 176
const TYPE_MS = 18

/** Stepped "pixel" border: four offset shadows instead of a rounded outline. */
function pixelBorder(color: string): string {
  return `0 -2px 0 0 ${color}, 0 2px 0 0 ${color}, -2px 0 0 0 ${color}, 2px 0 0 0 ${color}`
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface PetBubbleProps {
  open: boolean
  title: string
  body: string
  /** Horizontal centre of the pet, in lane pixels — the tail points here. */
  anchorX: number
  /** Measured lane width, so the bubble can be clamped inside the window. */
  laneWidth: number
  accent: string
}

function PetBubbleBase({
  open,
  title,
  body,
  anchorX,
  laneWidth,
  accent
}: PetBubbleProps): React.JSX.Element {
  const [typed, setTyped] = useState('')

  // Type the blurb out one character at a time each time the bubble opens.
  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    if (prefersReducedMotion()) {
      setTyped(body)
      return
    }
    let i = 0
    const id = setInterval(() => {
      i += 1
      setTyped(body.slice(0, i))
      if (i >= body.length) clearInterval(id)
    }, TYPE_MS)
    return () => clearInterval(id)
  }, [open, body])

  // Keep the bubble inside the widget: clamp its left edge to the lane, and let
  // the tail slide instead so it stays pinned over the pet.
  const left = Math.max(0, Math.min(anchorX - WIDTH / 2, Math.max(0, laneWidth - WIDTH)))
  const tailX = Math.max(6, Math.min(anchorX - left - 3, WIDTH - 12))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bubble"
          className="absolute z-20"
          style={{ left, top: 30, width: WIDTH, pointerEvents: 'none' }}
          initial={{ opacity: 0, y: -4, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.94 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {/* Tail: three stacked blocks stepping up toward the pet. */}
          <div style={{ position: 'absolute', top: -6, left: tailX }}>
            <div
              style={{
                width: 6,
                height: 3,
                marginLeft: 3,
                background: 'var(--color-app-surface)',
                boxShadow: `0 -2px 0 0 var(--color-app-border)`
              }}
            />
            <div
              style={{
                width: 12,
                height: 3,
                background: 'var(--color-app-surface)',
                boxShadow: `-2px 0 0 0 var(--color-app-border), 2px 0 0 0 var(--color-app-border)`
              }}
            />
          </div>

          <div
            className="px-2.5 py-2"
            style={{
              background: 'var(--color-app-surface)',
              boxShadow: pixelBorder('var(--color-app-border)'),
              color: 'var(--color-app-text)'
            }}
          >
            <div
              className="text-[9px] font-bold uppercase tracking-[0.14em]"
              style={{ color: accent }}
            >
              {title}
            </div>
            <div className="mt-0.5 text-[11px] leading-snug">
              {typed}
              {typed.length < body.length && (
                <span style={{ opacity: 0.6 }}>▌</span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const PetBubble = memo(PetBubbleBase)

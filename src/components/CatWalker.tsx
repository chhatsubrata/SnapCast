/**
 * Desktop-pet controller: a {@link PixelCat} that strolls back and forth along a
 * lane, pausing to sit, sleep, or meow. Lives on top of the compact widget.
 *
 * Behaviour is a self-scheduling loop (random walks + random pauses). The lane
 * width is measured from the container so the cat never wanders off-edge. When a
 * screenshot is imminent the cat drops everything and meows in place — a playful
 * cue that mirrors the widget's risk colour.
 */

import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RiskLevel } from '@shared/types'
import { PixelCat, type CatBehavior } from './PixelCat'

const CAT_SIZE = 60
const SPEED = 22 // px per second

/** 0 = calm … 3 = panic. Drives how anxious the cat acts. */
function anxietyTier(risk: RiskLevel): number {
  switch (risk) {
    case RiskLevel.CRITICAL:
      return 3
    case RiskLevel.HIGH:
      return 2
    case RiskLevel.WARNING:
      return 1
    default:
      return 0
  }
}

interface CatWalkerProps {
  imminent: boolean
  risk: RiskLevel
}

function CatWalkerBase({ imminent, risk }: CatWalkerProps): React.JSX.Element {
  const laneRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(4)
  const [facing, setFacing] = useState<1 | -1>(1)
  const [behavior, setBehavior] = useState<CatBehavior>('walk')
  const [dur, setDur] = useState(2)

  // Refs so the scheduling loop reads live values without re-subscribing.
  const xRef = useRef(x)
  const maxRef = useRef(220)
  const imminentRef = useRef(imminent)
  const tierRef = useRef(anxietyTier(risk))
  xRef.current = x
  imminentRef.current = imminent
  tierRef.current = anxietyTier(risk)

  // Track lane width.
  useEffect(() => {
    const measure = (): void => {
      const w = laneRef.current?.clientWidth ?? 240
      maxRef.current = Math.max(0, w - CAT_SIZE)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (laneRef.current) ro.observe(laneRef.current)
    return () => ro.disconnect()
  }, [])

  // Behaviour loop.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const next = (ms: number): void => {
      timer = setTimeout(loop, ms)
    }

    // Pace to a random spot; speed scales up with anxiety.
    const walkSomewhere = (speedMul: number): void => {
      const target = Math.round(Math.random() * maxRef.current)
      const dist = Math.abs(target - xRef.current)
      const d = Math.max(0.4, dist / (SPEED * speedMul))
      setFacing(target >= xRef.current ? 1 : -1)
      setBehavior('walk')
      setDur(d)
      setX(target)
      next(d * 1000 + 80)
    }

    const loop = (): void => {
      if (cancelled) return
      const tier = tierRef.current

      // Panic: imminent or critical → frozen, meowing "switch tabs!".
      if (imminentRef.current || tier >= 3) {
        setBehavior('meow')
        next(600)
        return
      }

      // High risk → anxious: pace fast or stand alert with a "!".
      if (tier === 2) {
        if (Math.random() < 0.45) walkSomewhere(2.2)
        else {
          setBehavior(Math.random() < 0.6 ? 'alert' : 'meow')
          next(800)
        }
        return
      }

      // Warning → restless: brisk pacing, the odd nervous sit. Never naps.
      if (tier === 1) {
        if (Math.random() < 0.7) walkSomewhere(1.6)
        else {
          setBehavior(Math.random() < 0.5 ? 'alert' : 'sit')
          next(900)
        }
        return
      }

      // Calm → free time: stroll, sit, nap, the occasional meow.
      if (Math.random() < 0.55) {
        walkSomewhere(1)
      } else {
        const acts: CatBehavior[] = ['sit', 'sleep', 'sleep', 'sit', 'meow']
        const act = acts[Math.floor(Math.random() * acts.length)]
        setBehavior(act)
        const pause = act === 'sleep' ? 3500 + Math.random() * 3000 : 1400 + Math.random() * 1800
        next(pause)
      }
    }

    next(400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return (
    <div ref={laneRef} className="relative h-full w-full" style={{ pointerEvents: 'none' }}>
      <motion.div
        className="absolute bottom-[-27px]"
        style={{ width: CAT_SIZE, height: CAT_SIZE }}
        animate={{ x }}
        transition={{ duration: behavior === 'walk' ? dur : 0.2, ease: 'linear' }}
      >
        <PixelCat behavior={behavior} facing={facing} size={CAT_SIZE} />
      </motion.div>
    </div>
  )
}

export const CatWalker = memo(CatWalkerBase)

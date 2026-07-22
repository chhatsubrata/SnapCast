/**
 * Desktop-pet controller: the weekday mascot strolls back and forth along a
 * lane, pausing to sit, sleep, or call out. Lives on top of the compact widget.
 *
 * Which animal appears is decided by the local weekday (Mon otter … Sat fennec,
 * Sun the original cat) and re-evaluated at midnight so a long-running app
 * changes over without a restart.
 *
 * Behaviour is a self-scheduling loop (random walks + random pauses). The lane
 * width is measured from the container so the pet never wanders off-edge. When a
 * screenshot is imminent the pet drops everything and calls out in place — a
 * playful cue that mirrors the widget's risk colour.
 *
 * Hovering the pet for ~1.5s freezes it: it turns, waves, and a pixel speech
 * bubble types out what that animal stands for.
 */

import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RiskLevel } from '@shared/types'
import { useSettingsStore } from '@store/settingsStore'
import { PixelPet, type PetBehavior } from './PixelPet'
import {
  DAY_LABELS,
  GRID_HEIGHT,
  GRID_WIDTH,
  msUntilNextMidnight,
  msUntilNextShift,
  petForDate,
  petForRotation,
  type PetSprite
} from './sprites'
import { PetBubble } from './PetBubble'

const PET_SIZE = 60
const SPEED = 22 // px per second
/** How long the pointer must rest on the pet before it greets you. */
const HOVER_DELAY_MS = 1500

/**
 * The sprite is 13 rows tall but only ~11 rows of that are the animal, so the
 * SVG is nudged below the lane to put its feet on the widget's bar.
 */
const FOOT_OFFSET = (PET_SIZE / GRID_WIDTH) * (GRID_HEIGHT - 10) - 30

/** 0 = calm … 3 = panic. Drives how anxious the pet acts. */
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

interface PetWalkerProps {
  imminent: boolean
  risk: RiskLevel
}

function PetWalkerBase({ imminent, risk }: PetWalkerProps): React.JSX.Element {
  const laneRef = useRef<HTMLDivElement>(null)
  const [x, setX] = useState(4)
  const [facing, setFacing] = useState<1 | -1>(1)
  const [behavior, setBehavior] = useState<PetBehavior>('walk')
  const [dur, setDur] = useState(2)
  const [greeting, setGreeting] = useState(false)
  const [laneWidth, setLaneWidth] = useState(240)
  // Bumped by the rollover timer to re-pick the mascot; the value itself is unused.
  const [, setRollover] = useState(0)

  const hourly = useSettingsStore((s) => s.settings.appearance.hourlyMascots)
  const mascotStart = useSettingsStore((s) => s.settings.appearance.mascotStart)
  const mascotAnchor = useSettingsStore((s) => s.settings.appearance.mascotAnchor)

  // Which mascot is on duty: the one the user picked, then the next in the cast
  // every hour, wrapping back to the first once everyone has had a turn — it
  // never falls back to a default.
  const sprite: PetSprite = hourly
    ? petForRotation(new Date(), mascotStart, mascotAnchor)
    : petForDate(new Date())

  // Refs so the scheduling loop reads live values without re-subscribing.
  const xRef = useRef(x)
  const maxRef = useRef(220)
  const imminentRef = useRef(imminent)
  const tierRef = useRef(anxietyTier(risk))
  const greetingRef = useRef(greeting)
  xRef.current = x
  imminentRef.current = imminent
  tierRef.current = anxietyTier(risk)
  greetingRef.current = greeting

  // Re-pick the mascot when its shift ends: on the hour in rotation mode, at
  // local midnight otherwise. Rescheduled each time so it keeps ticking over.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const schedule = (): void => {
      const wait = hourly
        ? msUntilNextShift(new Date(), mascotAnchor)
        : msUntilNextMidnight(new Date())
      timer = setTimeout(() => {
        setRollover((n) => n + 1)
        schedule()
      }, wait)
    }
    schedule()
    return () => clearTimeout(timer)
  }, [hourly, mascotAnchor])

  // Track lane width.
  useEffect(() => {
    const measure = (): void => {
      const w = laneRef.current?.clientWidth ?? 240
      maxRef.current = Math.max(0, w - PET_SIZE)
      setLaneWidth(w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (laneRef.current) ro.observe(laneRef.current)
    return () => ro.disconnect()
  }, [])

  // Behaviour loop. Restarted when the greeting ends so the pet picks up its
  // normal routine again.
  useEffect(() => {
    if (greeting) return
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
      if (cancelled || greetingRef.current) return
      const tier = tierRef.current

      // Panic: imminent or critical → frozen, calling "switch tabs!".
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

      // Calm → free time: stroll, sit, nap, the occasional call.
      if (Math.random() < 0.55) {
        walkSomewhere(1)
      } else {
        const acts: PetBehavior[] = ['sit', 'sleep', 'sleep', 'sit', 'meow']
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
  }, [greeting])

  // Dwell on the pet → it stops and waves. Freezing `x` at its current value
  // cancels any in-flight walk animation.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    },
    []
  )

  const startHover = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      setX(xRef.current)
      setBehavior('wave')
      setGreeting(true)
    }, HOVER_DELAY_MS)
  }

  const endHover = (): void => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = null
    setGreeting(false)
  }

  return (
    <div ref={laneRef} className="relative h-full w-full" style={{ pointerEvents: 'none' }}>
      <motion.div
        className="absolute"
        style={{ width: PET_SIZE, height: PET_SIZE, bottom: FOOT_OFFSET }}
        animate={{ x }}
        transition={{ duration: behavior === 'walk' ? dur : 0.2, ease: 'linear' }}
      >
        <PixelPet sprite={sprite} behavior={behavior} facing={facing} size={PET_SIZE} />
        {/*
         * Hover target: only as tall as the lane, so it never covers the expand
         * button that the sprite visually overhangs. The lane itself is
         * pointer-transparent, so this is the one interactive piece.
         */}
        <div
          className="absolute inset-x-0 top-0"
          style={{ height: 32, pointerEvents: 'auto' }}
          onPointerEnter={startHover}
          onPointerLeave={endHover}
        />
      </motion.div>

      <PetBubble
        open={greeting}
        // Weekday mode names the day; in rotation (or for the bonus mascots,
        // which have no day) the animal's name carries the bubble on its own.
        title={
          !hourly && sprite.weekday !== null
            ? `${DAY_LABELS[sprite.weekday]} · ${sprite.name.toUpperCase()}`
            : sprite.name.toUpperCase()
        }
        body={sprite.theme}
        anchorX={x + PET_SIZE / 2}
        laneWidth={laneWidth}
        accent={sprite.accent}
      />
    </div>
  )
}

export const PetWalker = memo(PetWalkerBase)

/**
 * Draws one pose of a {@link PetSprite} as a crisp SVG pixel grid.
 *
 * Generalised from the original side-profile pixel cat: colours come from the
 * sprite's palette instead of module constants, so every weekday mascot renders
 * through this one component. Movement across the widget is owned by
 * {@link PetWalker}; this component only draws a single behaviour:
 *   - walk  -> frameA/frameB alternate for a stepping gait (or a wing beat)
 *   - sit   -> at rest, blinking, with a slow idle tic (ear/tail/wing)
 *   - sleep -> lying down, eyes shut, floating Zzz
 *   - meow  -> the pet's voice glyph pops above it (screenshot imminent)
 *   - alert -> a nervous "!" and a shiver
 *   - wave  -> greets the user (hover), arm/wing up and down
 *
 * `facing` flips the sprite horizontally; the floating glyphs are drawn
 * un-flipped so text stays readable.
 */

import { memo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GRID_HEIGHT, GRID_WIDTH, type PetSprite } from './sprites'

export type PetBehavior = 'walk' | 'sit' | 'sleep' | 'meow' | 'alert' | 'wave'

/** Frame-swap cadence per behaviour, in ms. */
const STEP_MS = 170
const HOVER_STEP_MS = 90
const IDLE_MS = 1800
const WAVE_MS = 300

/** Resolve a grid character to a colour, honouring the blink. */
function cellColor(char: string, palette: Record<string, string>, blink: boolean): string | null {
  if (char === '.') return null
  if (char === 'E') return blink ? (palette['o'] ?? null) : (palette['E'] ?? null)
  if (char === '-') return palette['E'] ?? null
  return palette[char] ?? null
}

interface PixelPetProps {
  sprite: PetSprite
  behavior: PetBehavior
  facing: 1 | -1
  size?: number
}

function PixelPetBase({ sprite, behavior, facing, size = 28 }: PixelPetProps): React.JSX.Element {
  const [step, setStep] = useState(false)
  const [blink, setBlink] = useState(false)

  const hovers = sprite.locomotion === 'hover'

  // Frame shuffle: walk gait, wing beat, wave, or the slow resting tic.
  useEffect(() => {
    const period =
      behavior === 'walk'
        ? hovers
          ? HOVER_STEP_MS
          : STEP_MS
        : behavior === 'wave'
          ? WAVE_MS
          : behavior === 'sit'
            ? IDLE_MS
            : null
    if (period === null) {
      setStep(false)
      return
    }
    const id = setInterval(() => setStep((s) => !s), period)
    return () => clearInterval(id)
  }, [behavior, hovers])

  // Occasional blink while resting.
  useEffect(() => {
    if (behavior !== 'sit' && behavior !== 'wave') return
    let t: ReturnType<typeof setTimeout>
    const id = setInterval(() => {
      setBlink(true)
      t = setTimeout(() => setBlink(false), 150)
    }, 2600)
    return () => {
      clearInterval(id)
      clearTimeout(t)
    }
  }, [behavior])

  const sleeping = behavior === 'sleep'
  const grid = sleeping
    ? sprite.sleep
    : behavior === 'walk'
      ? step
        ? sprite.frameB
        : sprite.frameA
      : behavior === 'wave'
        ? step
          ? sprite.wave
          : sprite.frameA
        : behavior === 'sit' && step
          ? sprite.idle
          : sprite.frameA

  const cells: React.JSX.Element[] = []
  grid.forEach((row, y) => {
    row.split('').forEach((char, x) => {
      const color = cellColor(char, sprite.palette, blink)
      if (color) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />)
    })
  })

  // Whole-body motion: breathe asleep, hop when calling out, shiver when alert,
  // lean into the wave, and bob continuously when airborne.
  const animate = sleeping
    ? { scaleY: [1, 1.05, 1] }
    : behavior === 'meow'
      ? { y: [0, -1, 0] }
      : behavior === 'alert'
        ? { x: [0, -0.6, 0.6, 0] }
        : behavior === 'wave'
          ? { rotate: [0, -3, 0] }
          : hovers
            ? { y: [0, -1.2, 0] }
            : { y: 0 }
  const transition = sleeping
    ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
    : behavior === 'meow'
      ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' }
      : behavior === 'alert'
        ? { duration: 0.28, repeat: Infinity, ease: 'easeInOut' }
        : behavior === 'wave'
          ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
          : hovers
            ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.2 }

  // Flip the sprite (not the glyphs) when facing left.
  const flip = facing === -1 ? `translate(${GRID_WIDTH},0) scale(-1,1)` : undefined

  // The face sits on the right by default and on the left when flipped, so the
  // floating glyphs must emit from the matching side and drift outward.
  const faceR = facing === 1
  // Glyph positions live entirely in the SVG x/y ATTRIBUTES (deterministic viewBox
  // units). We do NOT animate x/y with framer-motion: those keys become CSS
  // transforms whose unit (px vs user-unit) is browser-dependent, which drags the
  // glyphs to centre. Instead each is pinned and we only pulse opacity.
  const zX = faceR ? 12 : 3
  const dir = faceR ? 1 : -1 // toward the face/front
  const noteX = faceR ? 13 : 2 // voice glyph near the mouth
  const alertX = faceR ? 13 : 2 // ! above the head
  const highlight = sprite.palette['W'] ?? '#ffffff'
  const shade = sprite.palette['d'] ?? '#000000'

  return (
    <motion.svg
      width={size}
      height={(size / GRID_WIDTH) * GRID_HEIGHT}
      viewBox={`0 0 ${GRID_WIDTH} ${GRID_HEIGHT}`}
      shapeRendering="crispEdges"
      aria-hidden
      animate={animate}
      transition={transition}
      style={{ overflow: 'visible' }}
    >
      <g transform={flip}>{cells}</g>

      {sleeping &&
        [0, 1, 2].map((i) => (
          <motion.text
            key={`z${i}`}
            // Pinned trail: each Z a step higher and further toward the face.
            x={zX + dir * i * 1.1}
            y={6 - i * 1.9}
            fontSize={2.8 + i * 1}
            fontWeight="bold"
            fill={highlight}
            stroke={shade}
            strokeWidth={0.35}
            paintOrder="stroke"
            textAnchor="middle"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2.1, repeat: Infinity, delay: i * 0.55, ease: 'easeInOut' }}
          >
            Z
          </motion.text>
        ))}

      {behavior === 'meow' &&
        [0, 1].map((i) => (
          <motion.text
            key={`n${i}`}
            x={noteX + dir * i * 1.2}
            y={5 - i * 1.8}
            fontSize={3.4}
            fontWeight="bold"
            fill={sprite.accent}
            stroke={highlight}
            strokeWidth={0.25}
            paintOrder="stroke"
            textAnchor="middle"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
          >
            {sprite.glyph}
          </motion.text>
        ))}

      {behavior === 'alert' && (
        <motion.text
          x={alertX}
          y={5}
          fontSize={4.5}
          fontWeight="bold"
          fill={sprite.accent}
          stroke={highlight}
          strokeWidth={0.3}
          paintOrder="stroke"
          textAnchor="middle"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          !
        </motion.text>
      )}
    </motion.svg>
  )
}

export const PixelPet = memo(PixelPetBase)

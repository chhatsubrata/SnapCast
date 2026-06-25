/**
 * Side-profile pixel-art cat used as a desktop pet on top of the compact widget.
 *
 * This component only draws a single pose; movement across the widget is owned by
 * {@link CatWalker}. Poses:
 *   - walk  -> standing body, legs alternate for a stepping gait
 *   - sit   -> standing still, blinks at rest
 *   - sleep -> lying down, eyes shut, floating Zzz
 *   - meow  -> standing, a little ♪ pops above (used when a screenshot is imminent)
 *
 * 16x11 SVG pixel grid (crisp edges, no raster asset). `facing` flips the cat
 * horizontally; the floating glyphs are drawn un-flipped so text stays readable.
 */

import { memo, useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export type CatBehavior = 'walk' | 'sit' | 'sleep' | 'meow' | 'alert'

const FUR = '#f4a259'
const DARK = '#b5651d'
const BELLY = '#ffe3c2'
const NOSE = '#e8657f'
const EYE = '#3a2a1a'

// Head-on-right body (rows 0-7). 'E' = eye (hidden on blink).
const BODY = [
  '................',
  '...........d.d..',
  '..........ddddd.',
  'd.........ooooo.',
  'dd.ooooooooooEo.',
  'dd.ooooooooooWN.',
  '...ooooooooooo..',
  '...oWWWWWWWoo...'
]

// Two leg frames (rows 8-10) → stepping gait.
const LEGS_A = ['....dd...dd.....', '....oo...oo.....', '................']
const LEGS_B = ['...dd.....dd....', '...oo.....oo....', '................']

// Lying-down pose, eyes shut ('-').
const SLEEP = [
  '................',
  '................',
  '................',
  '...........dd...',
  '..........ooooo.',
  'dd.ooooooooo-oo.',
  'dd.oooooooooooN.',
  '..oWWWWWWWWWoo..',
  '...oooooooooo...',
  '................',
  '................'
]

function cellColor(char: string, blink: boolean): string | null {
  switch (char) {
    case 'o':
      return FUR
    case 'd':
      return DARK
    case 'W':
      return BELLY
    case 'N':
      return NOSE
    case '-':
      return EYE
    case 'E':
      return blink ? FUR : EYE
    default:
      return null
  }
}

interface PixelCatProps {
  behavior: CatBehavior
  facing: 1 | -1
  size?: number
}

function PixelCatBase({ behavior, facing, size = 28 }: PixelCatProps): React.JSX.Element {
  const [step, setStep] = useState(false)
  const [blink, setBlink] = useState(false)

  // Leg shuffle while walking.
  useEffect(() => {
    if (behavior !== 'walk') return
    const id = setInterval(() => setStep((s) => !s), 170)
    return () => clearInterval(id)
  }, [behavior])

  // Occasional blink while sitting.
  useEffect(() => {
    if (behavior !== 'sit') return
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
  const grid = sleeping ? SLEEP : [...BODY, ...(step ? LEGS_B : LEGS_A)]
  const eyeClosed = behavior === 'sit' && blink

  const cells: React.JSX.Element[] = []
  grid.forEach((row, y) => {
    row.split('').forEach((char, x) => {
      const color = cellColor(char, eyeClosed)
      if (color) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />)
    })
  })

  // Whole-cat motion: breathe asleep, hop when meowing, nervous shake when alert.
  const animate = sleeping
    ? { scaleY: [1, 1.05, 1] }
    : behavior === 'meow'
      ? { y: [0, -1, 0] }
      : behavior === 'alert'
        ? { x: [0, -0.6, 0.6, 0] }
        : { y: 0 }
  const transition = sleeping
    ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
    : behavior === 'meow'
      ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' }
      : behavior === 'alert'
        ? { duration: 0.28, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 0.2 }

  // Flip the cat (not the glyphs) when facing left.
  const flip = facing === -1 ? 'translate(16,0) scale(-1,1)' : undefined

  // The face/mouth sits on the right by default and on the left when flipped, so
  // the floating glyphs must emit from the matching side and drift outward.
  const faceR = facing === 1
  // Head sits on the right by default, on the left when flipped. Sleep Zzz rise
  // from just above the head centre and drift slightly toward the face (front),
  // never back over the body.
  // Glyph positions live entirely in the SVG x/y ATTRIBUTES (deterministic viewBox
  // units). We do NOT animate x/y with framer-motion: those keys become CSS
  // transforms whose unit (px vs user-unit) is browser-dependent and was dragging
  // the Zzz to centre. Instead each Z is pinned and we only pulse opacity — three
  // staggered Z's form the rising trail. col 12 mirrors to col 3 when flipped.
  const zX = faceR ? 12 : 3
  const dir = faceR ? 1 : -1 // toward the face/front
  const noteX = faceR ? 13 : 2 // meow ♪ near the mouth
  const alertX = faceR ? 13 : 2 // ! above the head

  return (
    <motion.svg
      width={size}
      height={(size / 16) * 11}
      viewBox="0 0 16 11"
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
            y={4 - i * 1.9}
            fontSize={2.8 + i * 1}
            fontWeight="bold"
            fill={BELLY}
            stroke={DARK}
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
            y={3 - i * 1.8}
            fontSize={3.4}
            fontWeight="bold"
            fill={NOSE}
            stroke={BELLY}
            strokeWidth={0.25}
            paintOrder="stroke"
            textAnchor="middle"
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.3, ease: 'easeOut' }}
          >
            ♪
          </motion.text>
        ))}

      {behavior === 'alert' && (
        <motion.text
          x={alertX}
          y={3}
          fontSize={4.5}
          fontWeight="bold"
          fill={NOSE}
          stroke={BELLY}
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

export const PixelCat = memo(PixelCatBase)

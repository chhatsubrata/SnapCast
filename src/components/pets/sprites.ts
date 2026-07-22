/**
 * Workweek Animals — the desktop-pet sprite pack.
 *
 * The pixel art itself lives in `sprites.json` so the renderer and the PNG
 * export script (`scripts/generate-pets.mjs`) read exactly the same source; this
 * module only types it and maps weekdays to mascots.
 *
 * Grid contract — every frame of every sprite:
 *   - 16 columns x 13 rows, feet on row 11 (row 12 is spare),
 *   - '.' transparent, any other char is looked up in the sprite's `palette`,
 *   - 'E' is the open eye (drawn in the base colour while blinking), '-' the
 *     closed eye,
 *   - lighting comes from the upper-left: 'W' highlights, 'd' shades.
 *
 * Frames: `frameA`/`frameB` are the two-step walk (or wing-beat) cycle, `idle`
 * is the resting tic (ear twitch / tail wag / wing flutter), `wave` greets the
 * user on hover, `sleep` is the lying-down pose.
 */

import data from './sprites.json'

export type PetId =
  | 'cat'
  | 'otter'
  | 'red-panda'
  | 'meerkat'
  | 'beaver'
  | 'bee'
  | 'owl'
  | 'penguin'
  | 'fennec'

/** How the pet gets around: on the ground, or airborne (the bee). */
export type Locomotion = 'walk' | 'hover'

export interface PetSprite {
  id: PetId
  /**
   * 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay`, or `null` for
   * the bonus mascots that only appear in the hourly rotation.
   */
  weekday: number | null
  name: string
  /** The work-culture blurb shown in the hover bubble. */
  theme: string
  locomotion: Locomotion
  /** Character used for the pet's "voice" glyph when it calls out. */
  glyph: string
  /** Colour for the floating glyphs (voice, alert). */
  accent: string
  palette: Record<string, string>
  frameA: string[]
  frameB: string[]
  idle: string[]
  wave: string[]
  sleep: string[]
}

export const GRID_WIDTH = 16
export const GRID_HEIGHT = 13

export const PET_SPRITES = data as PetSprite[]

/** Short day labels, indexed like `Date.prototype.getDay`. */
export const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

const BY_WEEKDAY = new Map(PET_SPRITES.filter((p) => p.weekday !== null).map((p) => [p.weekday, p]))
const BY_ID = new Map(PET_SPRITES.map((p) => [p.id, p]))

/** The cat is the fallback everywhere: Sunday's mascot and the "timer running" pet. */
export const DEFAULT_PET = BY_ID.get('cat') ?? PET_SPRITES[0]

/**
 * Hourly rotation order: the six workweek animals, the two bonus mascots, then
 * the cat. Fixed (not weekday-derived) so the cycle is stable and predictable.
 */
export const ROTATION: PetSprite[] = (
  ['otter', 'red-panda', 'meerkat', 'beaver', 'bee', 'owl', 'penguin', 'fennec', 'cat'] as PetId[]
)
  .map((id) => BY_ID.get(id))
  .filter((p): p is PetSprite => p !== undefined)

/** The mascot on duty for a given date — Sunday keeps the original cat. */
export function petForDate(date: Date): PetSprite {
  return BY_WEEKDAY.get(date.getDay()) ?? DEFAULT_PET
}

const HOUR_MS = 3_600_000

/**
 * Whose shift it is in the hourly rotation.
 *
 * Picking a mascot puts it on duty immediately (`start` + `anchor`); each hour
 * after that the next one in cast order takes over, wrapping back to the first
 * once everyone has had a turn. With nothing picked the rotation follows the
 * clock hour instead.
 */
export function petForRotation(now: Date, start: string | null, anchor: number): PetSprite {
  const startIndex = start ? ROTATION.findIndex((p) => p.id === start) : -1
  if (startIndex === -1 || !anchor) return petForSlot(ROTATION, now.getHours())
  const shifts = Math.max(0, Math.floor((now.getTime() - anchor) / HOUR_MS))
  return petForSlot(ROTATION, startIndex + shifts)
}

/** Ms until the current mascot's shift ends and the next one takes over. */
export function msUntilNextShift(now: Date, anchor: number): number {
  if (!anchor) return msUntilNextHour(now)
  const elapsed = now.getTime() - anchor
  if (elapsed < 0) return Math.max(1000, -elapsed)
  return Math.max(1000, HOUR_MS - (elapsed % HOUR_MS))
}

/**
 * Whose shift it is. `slot` counts hours — clock hours, or hours since the timer
 * started — and wraps back to the first mascot once everyone has had a turn.
 */
export function petForSlot(rotation: PetSprite[], slot: number): PetSprite {
  const n = rotation.length
  return rotation[((Math.floor(slot) % n) + n) % n]
}

/** The mascot for a given hour of the day, cycling through the whole cast. */
export function petForHour(date: Date): PetSprite {
  return petForSlot(ROTATION, date.getHours())
}

/** Ms from `date` until the next local midnight, when the mascot changes over. */
export function msUntilNextMidnight(date: Date): number {
  const next = new Date(date)
  next.setHours(24, 0, 0, 0)
  return Math.max(1000, next.getTime() - date.getTime())
}

/** Ms from `date` until the top of the next hour. */
export function msUntilNextHour(date: Date): number {
  const next = new Date(date)
  next.setHours(date.getHours() + 1, 0, 0, 0)
  return Math.max(1000, next.getTime() - date.getTime())
}

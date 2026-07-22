import { describe, expect, it } from 'vitest'
import {
  DAY_LABELS,
  DEFAULT_PET,
  GRID_HEIGHT,
  GRID_WIDTH,
  PET_SPRITES,
  ROTATION,
  msUntilNextHour,
  msUntilNextMidnight,
  msUntilNextShift,
  petForDate,
  petForHour,
  petForRotation,
  petForSlot
} from './sprites'

const FRAMES = ['frameA', 'frameB', 'idle', 'wave', 'sleep'] as const

describe('pet sprites', () => {
  it('covers every weekday exactly once', () => {
    const days = PET_SPRITES.map((s) => s.weekday)
      .filter((d): d is number => d !== null)
      .sort((a, b) => a - b)
    expect(days).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(DAY_LABELS).toHaveLength(7)
  })

  it('rotates through the whole cast, bonus mascots included', () => {
    expect(ROTATION).toHaveLength(PET_SPRITES.length)
    expect(new Set(ROTATION.map((s) => s.id)).size).toBe(PET_SPRITES.length)
    expect(ROTATION.map((s) => s.id)).toContain('owl')
    expect(ROTATION.map((s) => s.id)).toContain('penguin')
    expect(DEFAULT_PET.id).toBe('cat')
  })

  it('wraps back to the first mascot instead of falling back to the cat', () => {
    const n = ROTATION.length
    expect(petForSlot(ROTATION, n).id).toBe(ROTATION[0].id)
    expect(petForSlot(ROTATION, n + 1).id).toBe(ROTATION[1].id)
    // A long session (e.g. 14 hours in) keeps cycling, never parking on the cat.
    expect(petForSlot(ROTATION, 14).id).toBe(ROTATION[14 % n].id)
  })

  it('puts the picked mascot on duty and carries on from there', () => {
    const picked = new Date(2026, 6, 22, 10, 40).getTime()
    const at = (minutes: number): string =>
      petForRotation(new Date(picked + minutes * 60_000), 'owl', picked).id

    // Picking is immediate, and holds for the rest of that hour.
    expect(at(0)).toBe('owl')
    expect(at(59)).toBe('owl')
    // Then the cast follows on, one per hour, wrapping past the end.
    const owlIndex = ROTATION.findIndex((s) => s.id === 'owl')
    expect(at(60)).toBe(ROTATION[(owlIndex + 1) % ROTATION.length].id)
    expect(at(60 * ROTATION.length)).toBe('owl')
  })

  it('falls back to the clock hour when nothing is picked', () => {
    const now = new Date(2026, 6, 22, 14, 5)
    expect(petForRotation(now, null, 0).id).toBe(petForHour(now).id)
    // An unknown id must not leave the widget without a pet.
    expect(petForRotation(now, 'nope', now.getTime()).id).toBe(petForHour(now).id)
  })

  it('ends each shift an hour after the pick, not on the clock hour', () => {
    const picked = new Date(2026, 6, 22, 10, 40).getTime()
    expect(msUntilNextShift(new Date(picked + 25 * 60_000), picked)).toBe(35 * 60_000)
    expect(msUntilNextShift(new Date(picked), picked)).toBe(60 * 60_000)
    // No anchor -> back to the clock hour, and never a zero-delay timer.
    const now = new Date(2026, 6, 22, 9, 45)
    expect(msUntilNextShift(now, 0)).toBe(msUntilNextHour(now))
    expect(msUntilNextShift(new Date(picked + 60 * 60_000 - 10), picked)).toBeGreaterThanOrEqual(
      1000
    )
  })

  it('gives each hour a different mascot', () => {
    const at = (h: number): string => petForHour(new Date(2026, 6, 22, h)).id
    for (let h = 0; h < 23; h++) expect(at(h), `hour ${h}`).not.toBe(at(h + 1))
    // The cycle repeats once the cast has had a turn.
    expect(at(0)).toBe(at(ROTATION.length))
  })

  it.each(PET_SPRITES.map((s) => [s.id, s] as const))('%s has well-formed grids', (_id, sprite) => {
    for (const frame of FRAMES) {
      const grid = sprite[frame]
      expect(grid, `${sprite.id}.${frame} row count`).toHaveLength(GRID_HEIGHT)
      for (const row of grid) {
        expect(row, `${sprite.id}.${frame} row "${row}"`).toHaveLength(GRID_WIDTH)
      }
    }
  })

  it.each(PET_SPRITES.map((s) => [s.id, s] as const))(
    '%s only uses glyphs it has colours for',
    (_id, sprite) => {
      const used = new Set(
        FRAMES.flatMap((f) => sprite[f])
          .join('')
          .split('')
          .filter((c) => c !== '.' && c !== '-')
      )
      for (const glyph of used) {
        expect(sprite.palette, `${sprite.id} glyph '${glyph}'`).toHaveProperty(glyph)
      }
      // '-' (closed eye) borrows the eye colour, so that must always exist.
      expect(sprite.palette).toHaveProperty('E')
      expect(sprite.palette).toHaveProperty('o')
    }
  )

  it('gives every mascot hover copy', () => {
    for (const sprite of PET_SPRITES) {
      expect(sprite.name.length, sprite.id).toBeGreaterThan(0)
      expect(sprite.theme.length, sprite.id).toBeGreaterThan(10)
    }
  })

  it('maps weekdays to the right animal', () => {
    // 2026-07-20 is a Monday; the week runs otter -> fennec, Sunday keeps the cat.
    expect(petForDate(new Date(2026, 6, 20)).id).toBe('otter')
    expect(petForDate(new Date(2026, 6, 21)).id).toBe('red-panda')
    expect(petForDate(new Date(2026, 6, 22)).id).toBe('meerkat')
    expect(petForDate(new Date(2026, 6, 23)).id).toBe('beaver')
    expect(petForDate(new Date(2026, 6, 24)).id).toBe('bee')
    expect(petForDate(new Date(2026, 6, 25)).id).toBe('fennec')
    expect(petForDate(new Date(2026, 6, 26)).id).toBe('cat')
  })

  it('schedules the changeover at the next local midnight', () => {
    const at2312 = new Date(2026, 6, 22, 23, 12, 0)
    expect(msUntilNextMidnight(at2312)).toBe((47 * 60 + 60) * 1000)
    // Never returns 0, so a rollover timer can't spin.
    expect(msUntilNextMidnight(new Date(2026, 6, 22, 23, 59, 59, 900))).toBeGreaterThanOrEqual(1000)
  })

  it('schedules the hourly changeover on the hour', () => {
    expect(msUntilNextHour(new Date(2026, 6, 22, 9, 45, 0))).toBe(15 * 60 * 1000)
    expect(msUntilNextHour(new Date(2026, 6, 22, 23, 59, 59, 900))).toBeGreaterThanOrEqual(1000)
  })
})

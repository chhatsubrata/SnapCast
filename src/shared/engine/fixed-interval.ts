/**
 * Helpers for driving the fixed-interval cycle by hand.
 *
 * The engine derives the countdown from an anchor: the next capture is
 * `anchor + interval`, rolled forward past any whole intervals that have already
 * elapsed. So "the countdown should read R seconds from now" is a statement
 * about the anchor, and setting one is a matter of solving for it.
 *
 * Shared by main (which applies the change) and the renderer (which validates
 * the form before sending it), so both agree on what a legal entry is.
 */

/** Smallest countdown a user can set, in seconds — below this it is already gone. */
export const MIN_REMAINING_SECONDS = 1

export interface RemainingCheck {
  ok: boolean
  /** Why the entry was rejected, ready to show in the UI. */
  message?: string
}

/**
 * Is `seconds` a countdown this cycle can actually show?
 *
 * It cannot exceed the interval: the countdown never starts higher than one
 * whole interval, so asking for more describes a cycle that does not exist.
 */
export function checkRemainingSeconds(seconds: number, intervalSeconds: number): RemainingCheck {
  if (!Number.isFinite(seconds)) {
    return { ok: false, message: 'Enter a number of minutes.' }
  }
  if (intervalSeconds <= 0) {
    return { ok: false, message: 'Set an interval first.' }
  }
  if (seconds < MIN_REMAINING_SECONDS) {
    return { ok: false, message: 'Must be more than a moment away.' }
  }
  if (seconds > intervalSeconds) {
    const minutes = Math.round(intervalSeconds / 60)
    return {
      ok: false,
      message: `Cannot exceed the ${minutes}-minute interval.`
    }
  }
  return { ok: true }
}

/**
 * The anchor that makes the countdown read `remainingSeconds` right now.
 *
 * From `next = anchor + interval` and `next = now + remaining`:
 *   anchor = now + remaining - interval
 * which lands in the past for any remaining within one interval — exactly where
 * the previous capture would have been.
 */
export function anchorForRemaining(
  nowMs: number,
  remainingSeconds: number,
  intervalSeconds: number
): number {
  return Math.round(nowMs + remainingSeconds * 1000 - intervalSeconds * 1000)
}

/**
 * Risk-level presentation helpers: colours, labels and CSS variable values used
 * by the progress ring, borders and glow effects. Centralised so every surface
 * renders a given risk identically.
 */

import { RiskLevel } from '@shared/types'

export interface RiskTheme {
  label: string
  /** Tailwind text colour class. */
  text: string
  /** Primary accent (hex) for rings, borders, glows. */
  accent: string
  /** Soft background tint (rgba) for cards. */
  tint: string
}

export const RISK_THEME: Record<RiskLevel, RiskTheme> = {
  [RiskLevel.SAFE]: {
    label: 'SAFE',
    text: 'text-emerald-400',
    accent: '#34d399',
    tint: 'rgba(52, 211, 153, 0.12)'
  },
  [RiskLevel.WARNING]: {
    label: 'WARNING',
    text: 'text-yellow-400',
    accent: '#facc15',
    tint: 'rgba(250, 204, 21, 0.14)'
  },
  [RiskLevel.HIGH]: {
    label: 'HIGH',
    text: 'text-orange-400',
    accent: '#fb923c',
    tint: 'rgba(251, 146, 60, 0.16)'
  },
  [RiskLevel.CRITICAL]: {
    label: 'CRITICAL',
    text: 'text-red-400',
    accent: '#f87171',
    tint: 'rgba(248, 113, 113, 0.18)'
  }
}

/**
 * Interpolate the progress-ring colour green -> yellow -> orange -> red across
 * a 0..1 progress value, independent of the discrete risk bucket so the ring
 * transitions smoothly.
 */
export function ringColor(progress: number): string {
  const stops: Array<[number, [number, number, number]]> = [
    [0, [52, 211, 153]],
    [0.5, [250, 204, 21]],
    [0.75, [251, 146, 60]],
    [1, [248, 113, 113]]
  ]
  const p = Math.min(1, Math.max(0, progress))
  for (let i = 1; i < stops.length; i++) {
    const [pos, color] = stops[i]
    const [prevPos, prevColor] = stops[i - 1]
    if (p <= pos) {
      const t = (p - prevPos) / (pos - prevPos || 1)
      const c = prevColor.map((v, k) => Math.round(v + (color[k] - v) * t))
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    }
  }
  return 'rgb(248, 113, 113)'
}

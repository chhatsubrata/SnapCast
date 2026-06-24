/**
 * Live prediction store. Fed by the `prediction:update` push (1 Hz) and the
 * `status:badge` push from main. Components subscribe with selectors so a tick
 * only re-renders what actually changed.
 */

import { create } from 'zustand'
import {
  type PredictionResult,
  RiskLevel,
  type StatusBadge
} from '@shared/types'

const EMPTY_PREDICTION: PredictionResult = {
  nextEstimatedScreenshot: null,
  confidence: 0,
  riskPercentage: 0,
  riskLevel: RiskLevel.SAFE,
  secondsRemaining: null,
  intervalProgress: 0,
  imminent: false,
  algorithm: 'fixed-interval' as PredictionResult['algorithm']
}

interface PredictionState {
  prediction: PredictionResult
  badge: StatusBadge
  /** Epoch ms when the last update arrived (for local smoothing if needed). */
  updatedAt: number | null
  setPrediction: (prediction: PredictionResult) => void
  setBadge: (badge: StatusBadge) => void
  load: () => Promise<void>
  recordManual: () => Promise<void>
  restartLearning: () => Promise<void>
}

export const usePredictionStore = create<PredictionState>((set) => ({
  prediction: EMPTY_PREDICTION,
  badge: 'no-data',
  updatedAt: null,
  setPrediction: (prediction) => set({ prediction, updatedAt: Date.now() }),
  setBadge: (badge) => set({ badge }),
  load: async () => {
    const prediction = await window.api.invoke('prediction:get-status')
    set({ prediction, updatedAt: Date.now() })
  },
  recordManual: async () => {
    const prediction = await window.api.invoke('prediction:record-manual', undefined)
    set({ prediction, updatedAt: Date.now() })
  },
  restartLearning: async () => {
    await window.api.invoke('prediction:restart-learning')
  }
}))

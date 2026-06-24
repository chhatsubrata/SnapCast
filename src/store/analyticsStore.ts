/**
 * Analytics store. Holds the latest {@link AnalyticsData} snapshot used by the
 * dashboard charts and stat cards. Refreshed on demand and via the
 * `analytics:update` push.
 */

import { create } from 'zustand'
import { type AnalyticsData, RiskLevel } from '@shared/types'

const EMPTY: AnalyticsData = {
  stats: {
    totalEvents: 0,
    averageInterval: null,
    medianInterval: null,
    minInterval: null,
    maxInterval: null,
    standardDeviation: null,
    lastScreenshot: null,
    isLearning: true
  },
  events: [],
  confidenceTrend: [],
  prediction: {
    nextEstimatedScreenshot: null,
    confidence: 0,
    riskPercentage: 0,
    riskLevel: RiskLevel.SAFE,
    secondsRemaining: null,
    intervalProgress: 0,
    imminent: false,
    algorithm: 'weighted' as AnalyticsData['prediction']['algorithm']
  }
}

interface AnalyticsState {
  data: AnalyticsData
  setData: (data: AnalyticsData) => void
  load: () => Promise<void>
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  data: EMPTY,
  setData: (data) => set({ data }),
  load: async () => {
    const data = await window.api.invoke('analytics:get-data')
    set({ data })
  }
}))

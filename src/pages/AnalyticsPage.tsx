/**
 * Analytics dashboard. Shows aggregate learning statistics plus four Recharts
 * visualisations: interval history, confidence trend, screenshot timeline and a
 * risk timeline. Data comes from the analytics store, refreshed on mount and
 * via the `analytics:update` push.
 */

import { memo, useEffect, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts'
import { RefreshCw } from 'lucide-react'
import { useAnalyticsStore } from '@store/analyticsStore'
import { PageShell } from '@components/PageShell'
import { StatCard } from '@components/StatCard'
import {
  confidenceSeries,
  intervalSeries,
  riskSeries,
  timelineSeries
} from '@analytics/transform'
import { formatClock, formatDuration, formatPercent01 } from '@utils/format'

function AnalyticsPageBase(): React.JSX.Element {
  const data = useAnalyticsStore((s) => s.data)
  const load = useAnalyticsStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  const intervals = useMemo(() => intervalSeries(data.events), [data.events])
  const confidence = useMemo(() => confidenceSeries(data.confidenceTrend), [data.confidenceTrend])
  const timeline = useMemo(() => timelineSeries(data.events.slice(-60)), [data.events])
  const risk = useMemo(() => riskSeries(data), [data])

  const { stats, prediction } = data

  return (
    <PageShell
      title="Analytics"
      actions={
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <StatCard label="Total tracked" value={String(stats.totalEvents)} />
          <StatCard label="Average" value={formatDuration(stats.averageInterval)} />
          <StatCard label="Median" value={formatDuration(stats.medianInterval)} />
          <StatCard label="Shortest" value={formatDuration(stats.minInterval)} />
          <StatCard label="Longest" value={formatDuration(stats.maxInterval)} />
          <StatCard label="Std. deviation" value={formatDuration(stats.standardDeviation)} />
          <StatCard label="Confidence" value={formatPercent01(prediction.confidence)} />
          <StatCard label="Last screenshot" value={formatClock(stats.lastScreenshot)} />
          <StatCard
            label="Next predicted"
            value={formatClock(prediction.nextEstimatedScreenshot)}
          />
        </div>

        <ChartCard title="Interval History (s)">
          {intervals.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={intervals} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="index" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line type="monotone" dataKey="seconds" stroke="#38bdf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Confidence Trend (%)">
          {confidence.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={confidence} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="time" tickFormatter={(t) => formatClock(t)} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} labelFormatter={(t) => formatClock(Number(t))} />
                <Area type="monotone" dataKey="confidence" stroke="#34d399" fill="url(#confGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Screenshot Timeline">
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis
                  dataKey="time"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(t) => formatClock(t)}
                  tick={{ fontSize: 11 }}
                />
                <YAxis dataKey="value" hide domain={[0, 2]} />
                <ZAxis range={[60, 60]} />
                <Tooltip {...tooltipStyle} labelFormatter={(t) => formatClock(Number(t))} />
                <Scatter data={timeline} fill="#a78bfa" />
              </ScatterChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title="Risk Timeline (%)">
          {risk.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={risk} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeOpacity={0.1} />
                <XAxis dataKey="time" tickFormatter={(t) => formatClock(t)} tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} labelFormatter={(t) => formatClock(Number(t))} />
                <Area type="monotone" dataKey="confidence" stroke="#f87171" fill="url(#riskGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>
    </PageShell>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: 'rgba(24,24,27,0.92)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 12,
    color: '#fff'
  }
} as const

function ChartCard({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="rounded-xl border border-white/10 bg-white/40 p-3 dark:bg-white/5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
      {children}
    </section>
  )
}

function Empty(): React.JSX.Element {
  return (
    <div className="flex h-24 items-center justify-center text-xs text-zinc-400">
      Not enough data yet — keep learning.
    </div>
  )
}

export const AnalyticsPage = memo(AnalyticsPageBase)

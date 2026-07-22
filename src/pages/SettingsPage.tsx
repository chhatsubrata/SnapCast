/**
 * Settings page. Every control writes through the settings store, which sends a
 * patch to main and persists it via Electron Store. Sections mirror the product
 * spec: General, Appearance, Prediction, Auto Hide, Notifications.
 */

import { memo, useEffect, useState } from 'react'
import { RotateCcw, Timer } from 'lucide-react'
import { type ThemeMode } from '@shared/types'
import { useSettingsStore } from '@store/settingsStore'
import { PageShell } from '@components/PageShell'
import { RemainingInput } from '@components/RemainingInput'
import { PixelPet } from '@components/pets/PixelPet'
import {
  DAY_LABELS,
  PET_SPRITES,
  ROTATION,
  petForDate,
  petForRotation
} from '@components/pets/sprites'

function SettingsPageBase(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const update = useSettingsStore((s) => s.update)
  const reset = useSettingsStore((s) => s.reset)

  return (
    <PageShell
      title="Settings"
      actions={
        <button
          type="button"
          onClick={() => void reset()}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-black/10 dark:hover:bg-white/10"
          style={{ color: 'var(--color-app-muted)' }}
        >
          <RotateCcw size={13} /> Reset
        </button>
      }
    >
      <div className="mx-auto max-w-md space-y-6">
        {/* Screenshot privacy */}
        <Section title="Screenshot Privacy">
          <Toggle
            label="Exclude widget from screen capture"
            checked={settings.privacy.excludeFromCapture}
            onChange={(v) => update({ privacy: { ...settings.privacy, excludeFromCapture: v } })}
          />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            Asks the OS to omit this widget from screenshots and screen recordings. Works on Windows
            10 (2004+) and macOS. On Linux it has no effect — use the hotkey below to hide manually.
          </p>
          <div className="flex items-center justify-between gap-3 text-[13.5px]">
            <span className='text-[12.5px]'>Hide/show hotkey</span>
            <kbd
              className="rounded-md border px-1 pt-0.5 pb-0 text-xs"
              style={{ background: 'var(--color-app-surface)', borderColor: 'var(--color-app-border)' }}
            >
              Ctrl/⌘ + Shift + H
            </kbd>
          </div>
        </Section>

        {/* Screenshot source — hidden for now; re-enable when the detection wizard is wired up. */}
        {/* <Section title="Screenshot Source">
          <div className="flex items-center justify-between text-sm">
            <span>
              Active source
              <span
                className="ml-2 rounded-md px-1.5 py-0.5 text-xs"
                style={{ background: 'var(--color-app-surface)', color: 'var(--color-app-muted)' }}
              >
                {settings.source.type}
              </span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setView('wizard')}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-transform active:scale-[0.99]"
            style={{ background: 'var(--color-app-primary)', color: 'var(--color-on-primary)' }}
          >
            <Wand2 size={15} /> Open detection wizard
          </button>
        </Section> */}

        {/* General */}
        <Section title="General">
          <Toggle
            label="Launch on startup"
            checked={settings.general.launchOnStartup}
            onChange={(v) => update({ general: { ...settings.general, launchOnStartup: v } })}
          />
          <Toggle
            label="Always on top"
            checked={settings.general.alwaysOnTop}
            onChange={(v) => update({ general: { ...settings.general, alwaysOnTop: v } })}
          />
          <Toggle
            label="Start in compact mode"
            checked={settings.general.compactModeDefault}
            onChange={(v) => update({ general: { ...settings.general, compactModeDefault: v } })}
          />
          <Toggle
            label="Quit app on close (X)"
            checked={settings.general.quitOnClose}
            onChange={(v) => update({ general: { ...settings.general, quitOnClose: v } })}
          />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            When on, the X button fully closes the application. When off, it hides the widget to the
            tray and keeps running.
          </p>
          <Toggle
            label="Reset timer on close"
            checked={settings.general.resetTimerOnClose}
            onChange={(v) => update({ general: { ...settings.general, resetTimerOnClose: v } })}
          />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            Closing with the X button stops the timer and clears the sync cycle. Your settings are
            left untouched.
          </p>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <Select<ThemeMode>
            label="Theme"
            value={settings.appearance.theme}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
              { value: 'system', label: 'System' }
            ]}
            onChange={(v) => update({ appearance: { ...settings.appearance, theme: v } })}
          />
          <Slider
            label="Opacity"
            min={0.3}
            max={1}
            step={0.05}
            value={settings.appearance.opacity}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ appearance: { ...settings.appearance, opacity: v } })}
          />
          <Slider
            label="Widget size"
            min={0.8}
            max={1.5}
            step={0.05}
            value={settings.appearance.widgetScale}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => update({ appearance: { ...settings.appearance, widgetScale: v } })}
          />
        </Section>

        {/* Prediction */}
        <Section title="Prediction">
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            Fixed-interval mode: set the tracker&apos;s screenshot cadence and press{' '}
            <strong>Sync cycle now</strong> when the tracker starts so the widget knows where the
            cycle begins.
          </p>
          <NumberField
            label="Interval (minutes)"
            min={1}
            max={120}
            step={1}
            value={Math.round(settings.prediction.fixedIntervalSeconds / 60)}
            onChange={(minutes) =>
              update({
                prediction: {
                  ...settings.prediction,
                  fixedIntervalSeconds: Math.max(60, Math.round(minutes) * 60)
                }
              })
            }
          />
          <Slider
            label="Lead warning"
            min={5}
            max={120}
            step={5}
            value={settings.prediction.leadSeconds}
            format={(v) => `${v}s before`}
            onChange={(v) => update({ prediction: { ...settings.prediction, leadSeconds: v } })}
          />
          <Toggle
            label="Auto-hide widget before capture"
            checked={settings.autoHide.enabled}
            onChange={(v) => update({ autoHide: { ...settings.autoHide, enabled: v } })}
          />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            Hides the widget once the lead window starts and re-shows it a few seconds after the
            screenshot — so the widget itself never lands in the shot (works on Linux too, unlike
            OS capture exclusion).
          </p>
          <button
            type="button"
            onClick={() =>
              update({
                prediction: { ...settings.prediction, anchorTimestamp: Date.now() }
              })
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-transform active:scale-[0.99]"
            style={{ background: 'var(--color-app-primary)', color: 'var(--color-on-primary)' }}
          >
            <Timer size={15} /> Sync cycle now
          </button>
          <RemainingInput intervalSeconds={settings.prediction.fixedIntervalSeconds} />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            {settings.prediction.anchorTimestamp
              ? `Last synced ${new Date(settings.prediction.anchorTimestamp).toLocaleTimeString()}.`
              : 'Not synced yet.'}
          </p>

        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <Toggle
            label="Enable notifications"
            checked={settings.notifications.enabled}
            onChange={(v) => update({ notifications: { ...settings.notifications, enabled: v } })}
          />
          <Toggle
            label="Enable sounds"
            checked={settings.notifications.soundsEnabled}
            onChange={(v) =>
              update({ notifications: { ...settings.notifications, soundsEnabled: v } })
            }
          />
        </Section>

        {/* Mascots */}
        <Section title="Mascots">
          <Toggle
            label="Change mascot every hour"
            checked={settings.appearance.hourlyMascots}
            onChange={(v) => update({ appearance: { ...settings.appearance, hourlyMascots: v } })}
          />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            {settings.appearance.hourlyMascots
              ? 'Tap a mascot to put it on the widget now — the rest of the cast follows on from there, an hour each, starting over from the first once everyone has had a turn.'
              : 'One companion per weekday: otter, red panda, meerkat, beaver, bee, fennec fox, and the cat on Sunday.'}
          </p>
          <MascotStrip
            hourly={settings.appearance.hourlyMascots}
            onDuty={
              settings.appearance.hourlyMascots
                ? petForRotation(
                    new Date(),
                    settings.appearance.mascotStart,
                    settings.appearance.mascotAnchor
                  ).id
                : petForDate(new Date()).id
            }
            onPick={(id) =>
              update({
                appearance: {
                  ...settings.appearance,
                  mascotStart: id,
                  mascotAnchor: Date.now()
                }
              })
            }
          />
          <p className="text-[12px]" style={{ color: 'var(--color-app-muted)' }}>
            Hover a mascot on the widget for a moment and it will wave and tell you what it stands
            for.
          </p>
        </Section>
      </div>
    </PageShell>
  )
}

/**
 * The cast side by side, the one currently on duty highlighted. In weekday mode
 * each is labelled with its day; in hourly mode tapping one puts it on duty
 * right away and the rest of the cast follows on from there, an hour each.
 */
function MascotStrip({
  hourly,
  onDuty,
  onPick
}: {
  hourly: boolean
  onDuty: string
  onPick: (id: string) => void
}): React.JSX.Element {
  const cast = hourly
    ? ROTATION
    : [...PET_SPRITES]
        .filter((s) => s.weekday !== null)
        .sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0))
  const dutyIndex = ROTATION.findIndex((s) => s.id === onDuty)

  return (
    <div className="flex flex-wrap items-end justify-center gap-1">
      {cast.map((sprite, i) => {
        const active = sprite.id === onDuty
        // In hourly mode, show how many shifts away each mascot is rather than a
        // clock hour — the cast is longer than a working day.
        const turnsAway = (i - dutyIndex + ROTATION.length) % ROTATION.length
        const label = hourly
          ? active
            ? 'NOW'
            : `+${turnsAway}h`
          : DAY_LABELS[sprite.weekday ?? 0]

        const content = (
          <>
            <PixelPet sprite={sprite} behavior="sit" facing={1} size={38} />
            <span
              className="text-[9px] font-semibold tracking-wide"
              style={{ color: active ? 'var(--color-app-primary)' : 'var(--color-app-muted)' }}
            >
              {label}
            </span>
          </>
        )
        const boxStyle = {
          background: active ? 'var(--color-app-surface)' : 'transparent',
          boxShadow: active ? '0 0 0 1px var(--color-app-primary)' : undefined
        }

        return hourly ? (
          <button
            key={sprite.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(sprite.id)}
            title={`${sprite.name} — ${sprite.theme}`}
            className="flex flex-col items-center gap-1 rounded-xl px-1.5 pt-1 pb-0.5 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95"
            style={boxStyle}
          >
            {content}
          </button>
        ) : (
          <div
            key={sprite.id}
            title={`${sprite.name} — ${sprite.theme}`}
            className="flex flex-col items-center gap-1 rounded-xl px-1.5 pt-1 pb-0.5"
            style={boxStyle}
          >
            {content}
          </div>
        )
      })}
    </div>
  )
}

// --- Small form primitives -------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section>
      <h2
        className="mb-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--color-app-muted)' }}
      >
        {title}
      </h2>
      <div
        className="space-y-3 rounded-2xl border p-3.5"
        style={{ background: 'var(--color-app-surface-2)', borderColor: 'var(--color-app-border)' }}
      >
        {children}
      </div>
    </section>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          background: checked ? 'var(--color-app-primary)' : 'rgba(148,163,184,0.35)'
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </label>
  )
}

function Select<T extends string | number>({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <select
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value
          const match = options.find((o) => String(o.value) === raw)
          if (match) onChange(match.value)
        }}
        className="rounded-lg border px-2.5 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-app-primary)"
        style={{
          background: 'var(--color-app-surface)',
          borderColor: 'var(--color-app-border)',
          color: 'var(--color-app-text)'
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function NumberField({
  label,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}): React.JSX.Element {
  // Local draft so the user can clear the field and type freely; we only clamp
  // to [min, max] and commit on blur/Enter, never mid-keystroke.
  const [text, setText] = useState(String(value))

  // Re-sync when the external value changes (e.g. Reset) and we aren't editing.
  useEffect(() => {
    setText(String(value))
  }, [value])

  const commit = (): void => {
    const n = Number(text)
    if (text.trim() === '' || Number.isNaN(n)) {
      setText(String(value))
      return
    }
    const clamped = Math.min(max, Math.max(min, n))
    setText(String(clamped))
    onChange(clamped)
  }

  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        // Don't let the mouse wheel change the value; blur instead of scrubbing.
        onWheel={(e) => e.currentTarget.blur()}
        className="w-20 rounded-lg border px-2.5 py-1.5 text-right text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-app-primary)"
        style={{
          background: 'var(--color-app-surface)',
          borderColor: 'var(--color-app-border)',
          color: 'var(--color-app-text)'
        }}
      />
    </label>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  format,
  onChange
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  format: (v: number) => string
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <label className="block text-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-xs" style={{ color: 'var(--color-app-muted)' }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--color-app-primary)' }}
      />
    </label>
  )
}

export const SettingsPage = memo(SettingsPageBase)

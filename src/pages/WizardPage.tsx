/**
 * Screenshot Detection Wizard.
 *
 * Walks the user through configuring a NON-INVASIVE event source:
 *   1. choose a source type
 *   2. pick a folder / log file (for watcher sources)
 *   3. verify detection against the chosen target
 *   4. begin learning (persists the source config)
 *   5. show the resulting confidence/status
 *
 * No step ever touches third-party software; folder/log access is granted by
 * the user through the OS file dialog.
 */

import { memo, useState } from 'react'
import { Check, FolderOpen, FileText, Loader2, MousePointerClick } from 'lucide-react'
import { SourceType, type SourceConfig } from '@shared/types'
import { useSettingsStore } from '@store/settingsStore'
import { usePredictionStore } from '@store/predictionStore'
import { useWidgetStore } from '@store/widgetStore'
import { PageShell } from '@components/PageShell'

type Step = 0 | 1 | 2 | 3

const SOURCE_OPTIONS: Array<{ type: SourceType; label: string; desc: string; icon: typeof FolderOpen }> = [
  {
    type: SourceType.MANUAL,
    label: 'Manual',
    desc: 'Record screenshot events yourself from the widget or tray.',
    icon: MousePointerClick
  },
  {
    type: SourceType.FILE_WATCHER,
    label: 'Folder Watcher',
    desc: 'Watch a folder and detect newly created image files.',
    icon: FolderOpen
  },
  {
    type: SourceType.LOG_WATCHER,
    label: 'Log Watcher',
    desc: 'Tail a log file and match screenshot lines by pattern.',
    icon: FileText
  }
]

function WizardPageBase(): React.JSX.Element {
  const settings = useSettingsStore((s) => s.settings)
  const setView = useWidgetStore((s) => s.setView)
  const restartLearning = usePredictionStore((s) => s.restartLearning)

  const [step, setStep] = useState<Step>(0)
  const [config, setConfig] = useState<SourceConfig>(settings.source)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{ detected: boolean; sampleCount: number } | null>(
    null
  )

  const needsPath = config.type === SourceType.FILE_WATCHER || config.type === SourceType.LOG_WATCHER

  const pickTarget = async (): Promise<void> => {
    const path =
      config.type === SourceType.FILE_WATCHER
        ? await window.api.invoke('source:pick-folder')
        : await window.api.invoke('source:pick-file')
    if (path) setConfig((c) => ({ ...c, path }))
  }

  const runVerify = async (): Promise<void> => {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const result = await window.api.invoke('source:verify', config)
      setVerifyResult(result)
    } finally {
      setVerifying(false)
    }
  }

  const beginLearning = async (): Promise<void> => {
    await window.api.invoke('source:configure', config)
    await restartLearning()
    setStep(3)
  }

  return (
    <PageShell title="Detection Wizard">
      <div className="mx-auto max-w-md">
        <Stepper step={step} />

        {/* Step 1: source type */}
        {step === 0 && (
          <div className="space-y-2">
            {SOURCE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const selected = config.type === opt.type
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, type: opt.type }))}
                  className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? 'border-sky-400 bg-sky-500/10'
                      : 'border-white/10 bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon size={18} className="mt-0.5 text-sky-400" />
                  <span>
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">{opt.desc}</span>
                  </span>
                </button>
              )
            })}
            <NavRow
              onNext={() => setStep(needsPath ? 1 : 2)}
              nextLabel="Next"
            />
          </div>
        )}

        {/* Step 2: pick target */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {config.type === SourceType.FILE_WATCHER
                ? 'Select the folder where screenshots are saved.'
                : 'Select the log file to monitor.'}
            </p>
            <button
              type="button"
              onClick={() => void pickTarget()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-sky-400/60 py-6 text-sm text-sky-400 hover:bg-sky-500/10"
            >
              {config.type === SourceType.FILE_WATCHER ? <FolderOpen size={18} /> : <FileText size={18} />}
              {config.path ? 'Change selection' : 'Choose…'}
            </button>
            {config.path && (
              <p className="truncate rounded-lg bg-black/5 px-3 py-2 text-xs dark:bg-white/5">
                {config.path}
              </p>
            )}
            {config.type === SourceType.LOG_WATCHER && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-zinc-400">Match pattern (regex)</span>
                <input
                  value={config.logPattern ?? ''}
                  onChange={(e) => setConfig((c) => ({ ...c, logPattern: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-white/70 px-2 py-1 text-sm dark:bg-zinc-800"
                  placeholder="(screenshot|capture)"
                />
              </label>
            )}
            <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} nextDisabled={!config.path} />
          </div>
        )}

        {/* Step 3: verify */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Verify that screenshots can be detected from your chosen source.
            </p>
            <button
              type="button"
              onClick={() => void runVerify()}
              disabled={verifying}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/90 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {verifying ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {verifying ? 'Verifying…' : 'Run verification'}
            </button>
            {verifyResult && (
              <div
                className={`rounded-xl border p-3 text-sm ${
                  verifyResult.detected
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-yellow-400/40 bg-yellow-500/10 text-yellow-200'
                }`}
              >
                {verifyResult.detected
                  ? `Source reachable. ${verifyResult.sampleCount} sample(s) found.`
                  : 'Could not confirm detection yet — check the path/pattern or proceed and wait.'}
              </div>
            )}
            <NavRow
              onBack={() => setStep(needsPath ? 1 : 0)}
              onNext={() => void beginLearning()}
              nextLabel="Begin learning"
            />
          </div>
        )}

        {/* Step 4: done */}
        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
              <Check size={28} className="text-emerald-400" />
            </div>
            <h2 className="text-base font-semibold">Learning started</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              The engine is now observing timing and building predictions. Confidence improves as more
              events are recorded.
            </p>
            <button
              type="button"
              onClick={() => setView('widget')}
              className="w-full rounded-xl bg-sky-500/90 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Back to widget
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}

function Stepper({ step }: { step: Step }): React.JSX.Element {
  return (
    <div className="mb-5 flex items-center justify-center gap-2">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i <= step ? 'w-6 bg-sky-400' : 'w-3 bg-zinc-300 dark:bg-zinc-600'
          }`}
        />
      ))}
    </div>
  )
}

function NavRow({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between pt-2">
      {onBack ? (
        <button type="button" onClick={onBack} className="text-sm text-zinc-500 hover:underline">
          Back
        </button>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-xl bg-sky-500/90 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {nextLabel}
      </button>
    </div>
  )
}

export const WizardPage = memo(WizardPageBase)

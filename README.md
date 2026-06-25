# Screenshot Prediction Widget

A professional desktop **floating overlay** that predicts the timing of upcoming
screenshots from **observed historical screenshot events** — and shows a live
countdown, confidence, risk level and analytics.

> **It is a passive productivity overlay.** It never modifies, interferes with,
> bypasses, injects into, hooks, disables, manipulates, blocks, or evades any
> screenshot software. It only models the timing of events it is explicitly
> given (a folder you point it at, a log file you choose, or manual entries) and
> displays predictions. **Predictions are estimates — not guarantees.**

---

## Highlights

- 🪟 Frameless, transparent, always-on-top **glassmorphism widget** with expanded
  & compact modes (double-click to switch).
- ⏱️ Live **countdown**, animated **progress ring** (green → yellow → orange →
  red), **risk** and **confidence** readouts updated every second.
- 🧠 **Prediction engine** with three algorithms (Fixed Interval, Rolling
  Average, Weighted) and a confidence scorer.
- 🔌 Pluggable, **non-invasive** event sources: Manual, Folder Watcher, Log
  Watcher, plus a placeholder for future opt-in integrations.
- 🧙 **Detection wizard** to configure and verify a source, then begin learning.
- 📊 **Analytics dashboard** (Recharts): interval history, confidence trend,
  screenshot timeline, risk timeline.
- 🔔 Native **notifications**, configurable **auto-hide**, **system tray**, multi
  monitor & position persistence, dark/light/system themes.

---

## Install the app (end users)

You don't need any developer tools to *run* a released build — just download the
file for your OS from the project's **Releases** page and install it.

| OS | Download | How to install |
|----|----------|----------------|
| **Windows** | `SnapCast Setup x.y.z.exe` | Double-click → follow the installer. |
| **Windows (no install)** | `SnapCast x.y.z.exe` (portable) | Double-click to run — nothing installed. |
| **Linux (any)** | `SnapCast-x.y.z.AppImage` | `chmod +x` it, then double-click / run it. |
| **Linux (Debian/Ubuntu)** | `snapcast_x.y.z_amd64.deb` | `sudo apt install ./snapcast_x.y.z_amd64.deb` |
| **macOS** | `SnapCast-x.y.z.dmg` | Open the DMG → drag the app into **Applications**. |

After installing the `.deb`, **SnapCast** appears in your application menu
with its icon. If the menu icon doesn't refresh immediately, log out/in or run
`sudo gtk-update-icon-cache /usr/share/icons/hicolor`.

---

## Tech stack

Electron 37 · Vite 7 · electron-vite · React 19 · TypeScript 5 · TailwindCSS 4 ·
Framer Motion · Zustand · Electron Store · Recharts · Lucide · Electron Builder.

---

## Architecture

```
electron/
  main/
    index.ts             App lifecycle, security hardening, single-instance
    window-manager.ts    Overlay BrowserWindow, multi-monitor restore, pushes
    tray.ts              System tray menu
    notifications.ts     Native notifications (cooldowns, settings-gated)
    logger.ts            Append-only JSON file logging
    store.ts             electron-store persistence (settings, events, bounds)
    services/
      PredictionService.ts  Runtime orchestrator (1 Hz tick, auto-hide, alerts)
    sources/             Manual / FileWatcher / LogWatcher / Future + manager
    ipc/                 Centralized, type-safe ipcMain handlers
  preload/
    index.ts             Secure contextBridge → window.api (whitelisted)

src/
  shared/                Types + IPC contracts + PURE prediction engine (testable)
    engine/              statistics · predictors · confidence · PredictionEngine
  store/                 Zustand: widget / prediction / settings / analytics
  components/            ProgressRing, Countdown, RiskBadge, AlertShell, …
  widgets/               FloatingWidget (expanded + compact)
  pages/                 WizardPage, AnalyticsPage, SettingsPage
  analytics/             Chart data transforms
  hooks/                 useBridge (IPC sync), useTheme
  providers/             AppProviders (bridge + theme + compact default)
  utils/                 format · risk
```

### Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer can only reach a **whitelisted** `window.api.invoke/on` surface;
  unknown channels are rejected in the preload bridge.
- Navigation away from the bundled renderer is blocked; all permission requests
  are denied; external links open in the system browser.
- No process injection, memory reading, API hooking or screenshot manipulation —
  by design and by capability.

### How prediction works

1. A **source** reports observed screenshot events (timestamps only).
2. The **PredictionEngine** keeps the last 1000 events, derives interval
   statistics (avg/median/min/max/stddev) and estimates the next interval via
   the selected algorithm.
3. **Confidence** rises with more, steadier data; **risk** rises as the live
   countdown approaches the estimate, scaled by confidence.
4. The main process ticks once per second and pushes updates to the widget.

---

## Getting started

```bash
pnpm install        # also generates procedural icons via postinstall
pnpm dev            # run the app with HMR
```

### Scripts

```bash
pnpm dev            # electron-vite dev (HMR + fast refresh)
pnpm build          # typecheck + build main/preload/renderer
pnpm preview        # preview the production renderer
pnpm electron:dev   # dev with watch
pnpm electron:build # build + package with electron-builder
pnpm lint           # ESLint
pnpm typecheck      # tsc (node + web projects)
pnpm test           # Vitest (engine + utils)
pnpm icons          # regenerate app/tray icons
```

---

## Building installers

```bash
pnpm build:win      # NSIS installer + portable EXE
pnpm build:linux    # AppImage + DEB
pnpm build:mac      # DMG (x64 + arm64)
```

Artifacts are emitted to `release/<version>/`. Icons are generated into
`build/icon.png` and `resources/`; replace them with branded assets for a real
release.

---

## Testing strategy

The prediction logic is intentionally **pure and dependency-free**, so the heart
of the app is unit-tested without Electron:

- `src/shared/engine/PredictionEngine.test.ts` — statistics, confidence, risk
  bucketing, next-screenshot estimation (incl. rolling past missed intervals)
  and the 1000-event cap.
- `src/utils/format.test.ts` — countdown / duration / percentage formatting.

Recommended additions:

- **Sources** — drive `FileWatcherSource` / `LogWatcherSource` against a temp
  dir/file to assert events and de-duplication.
- **IPC** — contract tests asserting every `IpcRequestMap` channel has a handler.
- **Component** — render the widget with mocked `window.api` (jsdom) and assert
  risk → visual state mapping.

```bash
pnpm test           # run once
pnpm test:watch     # watch mode
```

---

## Performance

Targets: **CPU < 1%**, **Memory < 150 MB**. The renderer leans on `React.memo`,
`useMemo`, `useCallback` and selector-based Zustand subscriptions so a 1 Hz tick
only repaints what changed.

## Accessibility

Keyboard-focusable controls with `aria-label`s, `aria-live` countdown,
high-contrast and reduced-motion media handling, and an adjustable widget scale.

## Uploading to GitHub

New to git/GitHub? Follow the step-by-step guide in
**[GITHUB_SETUP.md](GITHUB_SETUP.md)** — it walks you through creating the repo
and pushing this project from scratch.

## License

MIT.

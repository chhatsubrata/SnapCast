# Build a Professional Desktop Floating Screenshot Prediction Widget

## Project Goal

Build a production-grade desktop floating widget application using modern Electron + Vite architecture.

The application acts as a desktop overlay that provides visibility into upcoming screenshot timing based on observed historical screenshot events.

The application must remain completely independent from third-party applications and must never modify, interfere with, bypass, inject into, hook, disable, manipulate, block, or evade screenshot software.

Its purpose is only to display predictions, countdowns, risk levels, analytics, and timing estimates.

---

# IMPORTANT IMPLEMENTATION REQUIREMENTS

Create this as an **Electron + Vite application using electron-vite (preferred)** with:

* Electron 37+
* Vite 7+
* React 19+
* TypeScript 5+
* TailwindCSS 4+
* Framer Motion
* Zustand
* Electron Store
* Recharts
* Lucide React
* Electron Builder

## Do NOT use

* Create React App
* Webpack
* Deprecated Electron patterns
* Node Integration in renderer
* Unsafe IPC patterns

Use secure preload-based IPC communication.

The codebase must be production-ready.

---

# Core Objective

Create a beautiful floating desktop widget that:

* Always stays visible
* Displays a live countdown
* Learns screenshot timing patterns
* Predicts future screenshot timing
* Displays prediction confidence
* Displays screenshot risk level
* Provides visual alerts as estimated screenshot timing approaches
* Optionally auto-hide itself based on configurable risk thresholds
* Automatically reappear after a configurable duration
* Provide detailed analytics and learning statistics

---

# Project Architecture

```text
project-root/
├── electron/
│   ├── main/
│   │   ├── index.ts
│   │   ├── tray.ts
│   │   ├── notifications.ts
│   │   ├── window-manager.ts
│   │   └── ipc/
│   │
│   └── preload/
│       └── index.ts
│
├── src/
│   ├── components/
│   ├── widgets/
│   ├── pages/
│   ├── hooks/
│   ├── store/
│   ├── analytics/
│   ├── settings/
│   ├── providers/
│   ├── prediction/
│   ├── utils/
│   ├── types/
│   └── App.tsx
│
├── public/
│
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

# Electron Window Requirements

Configure BrowserWindow with:

```ts
transparent: true
frame: false
alwaysOnTop: true
resizable: true
movable: true
skipTaskbar: false
```

Use secure Electron configuration:

```ts
webPreferences: {
  preload: preloadPath,
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

Support:

* Multi-monitor setups
* Window position persistence
* Window size persistence
* DPI scaling
* Auto restore previous position

---

# IPC Architecture

Create strongly typed IPC channels.

Examples:

```text
window:minimize
window:hide
window:show
window:set-always-on-top

settings:get
settings:update

prediction:get-status
prediction:get-history

analytics:get-data

widget:set-compact-mode
widget:set-theme
```

Requirements:

* Centralized IPC layer
* Type-safe requests
* Type-safe responses
* Shared TypeScript contracts

---

# Development Experience

Support:

* Vite HMR
* Fast Refresh
* Source Maps
* Strict TypeScript
* ESLint
* Prettier
* Path aliases
* Feature-based architecture

---

# Build System

Use Electron Builder.

## Windows

* NSIS Installer
* Portable EXE

## Linux

* AppImage
* DEB Package

## macOS

* DMG

Required scripts:

```bash
npm run dev
npm run build
npm run preview

npm run electron:dev
npm run electron:build

npm run lint
npm run typecheck
```

---

# Floating Widget Window

Create a desktop overlay widget.

Requirements:

* Frameless
* Transparent
* Rounded corners
* Glassmorphism design
* Draggable
* Always on top
* Doesn't steal focus
* Small memory footprint
* Position persists after restart

---

# Widget Modes

## Expanded Mode

Show:

* Countdown timer
* Risk percentage
* Confidence percentage
* Progress ring
* Current status
* Last screenshot time
* Next estimated screenshot

## Compact Mode

Show:

* Countdown only
* Risk indicator

Double-click switches modes.

---

# Theme Support

Implement:

* Dark Mode
* Light Mode
* System Mode

Persist preference.

Smooth transitions required.

---

# Main Timer Display

Large countdown timer:

```text
08:42
```

Display:

```text
Next Screenshot (Estimated)
```

Update every second.

Smooth animated transitions.

---

# Screenshot Prediction Engine

```ts
interface ScreenshotPredictionEngine {
  recordScreenshot(timestamp: Date): void;
  getPrediction(): PredictionResult;
  getRiskLevel(): RiskLevel;
}

interface PredictionResult {
  nextEstimatedScreenshot: Date;
  confidence: number;
  riskPercentage: number;
}

enum RiskLevel {
  SAFE,
  WARNING,
  HIGH,
  CRITICAL
}
```

---

# Screenshot Event Sources

Create pluggable providers.

## Manual Source

User manually records screenshot events.

## File Watcher Source

Watch selected folders.

Detect:

* New image creation
* New screenshot files

## Log Watcher Source

Watch configurable log files.

Parse screenshot events.

## Future Integration Provider

Placeholder provider for future integrations.

---

# Screenshot Detection Wizard

Wizard Flow:

1. Select source type
2. Select folder or log file
3. Verify screenshot detection
4. Begin learning mode
5. Display confidence status

---

# Learning Engine

Store:

* Last 1000 screenshot events
* Average interval
* Median interval
* Min interval
* Max interval
* Standard deviation

Persist using Electron Store.

---

# Prediction Algorithms

Implement:

## Fixed Interval Predictor

## Rolling Average Predictor

## Weighted Predictor

## Confidence Scoring Engine

Display:

```text
Confidence: 81%
```

---

# Risk System

Display:

```text
SAFE
WARNING
HIGH
CRITICAL
```

Show:

```text
Risk: 87%
Confidence: 81%
```

Update every second.

---

# Visual Alert System

## SAFE

* Calm UI

## WARNING

* Soft glow
* Gentle pulse

## HIGH

* Orange border
* Strong pulse

## CRITICAL

* Red glow
* Ring pulse
* Countdown emphasis
* Notification

Use Framer Motion.

---

# Progress Ring

Animated circular progress ring.

Color progression:

```text
Green → Yellow → Orange → Red
```

---

# Notification System

Notify for:

* Learning started
* Learning completed
* Screenshot detected
* High risk
* Critical risk
* Confidence improvement

Allow disabling notifications.

---

# Auto-Hide Feature

Settings:

```text
Enable Auto Hide

Threshold:
90%
95%
98%

Duration:
5 sec
10 sec
15 sec
20 sec
```

Default:

```text
95%
15 sec
```

Behavior:

```text
IF risk >= threshold
THEN hide widget

AFTER configured duration
show widget again
```

Display warning:

```text
Prediction Based
Not Guaranteed
```

---

# Analytics Dashboard

Show:

* Total screenshots tracked
* Average interval
* Median interval
* Shortest interval
* Longest interval
* Confidence trend
* Last screenshot
* Next predicted screenshot

Charts:

* Interval History
* Confidence Trend
* Screenshot Timeline
* Risk Timeline

Use Recharts.

---

# System Tray

Menu:

* Show Widget
* Hide Widget
* Analytics
* Settings
* Restart Learning
* Exit

---

# Settings

## General

* Launch on startup
* Always on top
* Compact mode default

## Appearance

* Theme
* Opacity
* Widget size

## Prediction

* Algorithm selection
* Confidence threshold

## Auto Hide

* Enable
* Threshold
* Duration

## Notifications

* Enable notifications
* Enable sounds

---

# Status Badges

```text
🟡 Learning
🟢 Tracking
🔵 High Confidence
⚪ No Data
```

---

# Performance Targets

```text
CPU < 1%
Memory < 150 MB
```

Use:

* React.memo
* useMemo
* useCallback

---

# State Management

Use Zustand.

Stores:

* WidgetStore
* PredictionStore
* SettingsStore
* AnalyticsStore

---

# Accessibility

Support:

* Keyboard navigation
* Screen readers
* High contrast mode
* Adjustable scaling

---

# Logging

Log:

* Screenshot detections
* Predictions
* Learning events
* Errors

Persist locally.

---

# Error Handling

Handle:

* Missing folders
* Missing permissions
* Invalid logs
* Corrupted settings

Gracefully.

---

# Security Requirements

The application MUST NOT:

* Inject into external processes
* Read process memory
* Hook screenshot APIs
* Modify screenshot software
* Disable screenshots
* Evade screenshots
* Interfere with third-party software

The application must remain a standalone desktop productivity overlay.

---

# Deliverables

Generate:

1. Complete architecture
2. Electron main process
3. Electron preload layer
4. Typed IPC system
5. React frontend
6. Floating widget
7. Prediction engine
8. Learning engine
9. Detection wizard
10. Analytics dashboard
11. Zustand stores
12. Settings system
13. Notification manager
14. Tray integration
15. Electron Store persistence
16. Build configuration
17. README
18. Unit testing strategy
19. Production build instructions

Generate production-quality, scalable, maintainable code following modern Electron + Vite best practices with detailed comments and strong TypeScript typing.

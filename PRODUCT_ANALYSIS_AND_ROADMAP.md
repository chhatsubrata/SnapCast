# SnapCast — Product Analysis, Architecture Review & Strategic Roadmap

> Prepared as a combined Principal Architect / Product / AI-Research / Business analysis.
> Every claim below is inferred **from the code in this repository**, not assumed.
> Version analysed: `snapcast@1.0.0` (Electron 37 desktop app, branch `Subrata`).

---

## 0. TL;DR (Executive Summary)

SnapCast is a **single-user Electron desktop overlay** that predicts *when the next screenshot will be taken* by an external program and shows a live countdown, risk meter, confidence, and analytics. It can optionally **hide itself from screen capture** (`setContentProtection`) and **auto-hide just before the predicted capture**.

- **What it technically is:** a clean, well-architected, local-only prediction/countdown widget with a pure testable engine and a secure Electron shell.
- **What it functionally is:** a tool to **anticipate and dodge employee-monitoring / time-tracker screenshots** (the code comments name "Top Tracker every 10 min", the lead-time feature exists to "give the user time to switch tabs", auto-hide keeps the widget "never in the shot").
- **The single most important strategic fact:** there is a hard fork in the road. The codebase is genuinely good, but its *current positioning* (surveillance evasion) caps it at a grey-market niche with app-store rejection risk, B2B impossibility, and legal exposure. The same engine can pivot into a **legitimate, sellable "focus / deep-work / time-awareness" product** with a far larger TAM. **Sections 4–6 treat both paths honestly.**

Maturity snapshot:

| Dimension | State |
|---|---|
| Architecture quality | **Strong** — clean separation, pure engine, typed IPC, hardened Electron |
| Feature completeness vs. its own spec | **~70%** (3 algorithms promised, only 1 wired; sources partially real) |
| Backend / cloud | **None** — fully local, electron-store JSON |
| Auth / multi-user / tenancy | **None** |
| Tests | **Minimal** — engine + format utils only |
| Monetization | **None** — MIT, no licensing, no telemetry, no billing |
| Enterprise readiness | **~5%** |

---

## 1. Product Understanding

### 1.1 What it is
A frameless, transparent, always-on-top **floating widget** (`src/widgets/FloatingWidget.tsx`) with compact and expanded modes. It shows a countdown to the *next estimated screenshot*, a progress ring (green→yellow→orange→red), a risk level (SAFE / WARNING / HIGH / CRITICAL), and a confidence %.

### 1.2 Problem it solves (as built)
The user is being screenshotted on a cadence (a strict-interval time tracker). SnapCast learns/configures that cadence and tells the user, second-by-second, how long until the next shot — and can hide itself and warn the user to "wrap up / switch tabs" before it lands.

### 1.3 Who the users are (inferred)
- **Primary:** remote workers / freelancers monitored by interval screenshot trackers (Hubstaff, Time Doctor, Upwork, TopTracker, Insightful, etc.) who want to know when a shot is imminent.
- **Secondary (legit framing):** anyone wanting a "deep-work tick" — a cadence-based focus/break overlay — though nothing in the UX is actually built for that today.

### 1.4 Industries that *could* use it (after repositioning)
Remote-work tooling, productivity/focus apps, presentation/screen-recording prep, kiosk/digital-signage timing overlays, streaming overlays, accessibility timers. (Today's build serves none of these as first-class; see Section 4.)

### 1.5 Core workflows (from code)
1. **Wizard** (`pages/WizardPage.tsx`): pick a source (Manual / Folder / Log), verify it, start learning.
2. **Fixed-interval config**: set cadence seconds + a "Sync" anchor timestamp (`prediction.fixedIntervalSeconds`, `anchorTimestamp`). The engine rolls the estimate forward past missed intervals.
3. **Live loop**: `PredictionService` ticks at 1 Hz, pushes `prediction:update`, `status:badge`, samples confidence every 30 s, fires notifications on risk transitions, and runs **auto-hide**.
4. **Stopwatch**: independent count-up `TimerService`.
5. **Analytics** (`pages/AnalyticsPage.tsx`): Recharts of interval history, confidence trend, timeline.
6. **Settings** (`pages/SettingsPage.tsx`): general / appearance / prediction / auto-hide / notifications / privacy.

### 1.6 Strengths
- Pure, deterministic, **unit-tested prediction engine** (`src/shared/engine/*`) decoupled from Electron.
- **Type-safe IPC contract** (`@shared/ipc`) — handler shape mismatches fail to compile.
- **Hardened Electron**: `contextIsolation`, `sandbox`, `nodeIntegration:false`, navigation blocking, permission denial, whitelisted preload bridge.
- Thoughtful UX details: top-right-pinned resize to avoid flicker, multi-monitor bounds restore, debounced persistence, reduced-motion/high-contrast handling, content-protection.
- Honest defensive persistence (corrupt config → defaults, settings migration of removed algorithms).

### 1.7 Weaknesses / gaps
- **Spec drift:** README & wizard advertise *three* algorithms; only `FIXED_INTERVAL` is wired (`AlgorithmType` enum has one member). Rolling-average/weighted predictors were removed. The "learning engine" is mostly cosmetic when a fixed interval is set (confidence is hard-coded to `1`).
- **Single-user, single-device, no sync, no backend.**
- **Thin test coverage** — sources, IPC contract, components untested (README itself lists these as "recommended additions").
- **No monetization, telemetry, update channel config, or analytics of usage.**
- **Positioning/legal risk** (Section 4.4).

---

## 2. Architecture Review

### 2.1 Shape
```
electron/main/        Node side: lifecycle, window, tray, notifications, store, services, sources, ipc
electron/preload/     Secure contextBridge → window.api (whitelisted invoke/on)
src/shared/           Types + IPC contracts + PURE engine (imported by both sides)
src/store/            Zustand stores (prediction/settings/analytics/widget/timer)
src/{components,widgets,pages,hooks,providers,utils,analytics}
```

### 2.2 What's good
- **Single source of truth:** `PredictionService` owns runtime truth; IPC handlers are thin pass-throughs.
- **Pure core / impure shell split:** engine takes `now` as a parameter → trivially testable, deterministic.
- **Push model:** main → renderer via typed `windows.send(channel, payload)`; renderer subscribes with selectors so a 1 Hz tick only repaints deltas.
- **Source abstraction:** `ScreenshotSource` interface + `SourceManager` (one active at a time, clean start/stop, no handle leaks).

### 2.3 Architectural weaknesses / missing abstractions
| Gap | Impact |
|---|---|
| No persistence abstraction beyond `electron-store` flat JSON | Hard to migrate to SQLite/cloud; no schema versioning beyond ad-hoc merge |
| No event bus / domain-event layer | Service is becoming a god-object (timer, notifications, autohide, trend, badge all inline) |
| `FutureSource` is a literal placeholder | "Pluggable integrations" promised but not realised |
| No background-job/scheduler abstraction | Two raw `setInterval`s (`PredictionService`, `TimerService`) — fine now, won't scale to many timers |
| Confidence/risk math is local-only | No model versioning, no A/B, no server-side improvement loop |
| No DI/container | Wiring is manual in `index.ts`; OK at this size |

### 2.4 Scalability
- **Vertical (one machine):** excellent — sub-1% CPU target, <150 MB RAM, capped 1000 events / 500 trend samples.
- **Horizontal (fleet/org):** **non-existent** — no server, no multi-device, no aggregate analytics. This is the biggest architectural ceiling for any SaaS ambition.

### 2.5 Technical debt
- README/spec vs. implementation divergence (algorithms, "learning").
- Two filenames carry a `.md.md` double extension (`FLOATING_..._PROMPT.md.md`).
- `release/1.0.0/linux-unpacked/**` (full unpacked Electron + `.deb` + `.AppImage`) is committed to git — **bloats the repo with binaries**; should be `.gitignore`d.
- Stopwatch and prediction countdown are two parallel time systems with overlapping concepts.

---

## 3. Code Quality Review

**Overall: B+ for a 1.0 solo build.** Clean, commented, idiomatic, strongly typed.

Highlights:
- Excellent doc-comments explaining *why* (e.g. resize ordering to avoid macOS flicker, epoch-ms over `Date` across IPC).
- Defensive loading everywhere.
- Good use of `React.memo`/selectors (per README; verify in components).

Issues to fix:
- **Coverage:** add the tests the README already enumerates (sources against temp dirs; IPC contract test asserting every `IpcRequestMap` channel has a handler; component render with mocked `window.api`).
- **Dead/partial features:** either re-implement rolling/weighted predictors or remove them from README/wizard to stop misleading users.
- **`fs.watch` reliability:** `FileWatcherSource` relies on `fs.watch` `'rename'` semantics, which are platform-inconsistent and miss atomic-rename saves on some OSes. Consider `chokidar` for robustness (currently avoided to skip native deps — a conscious trade-off worth revisiting).
- **No structured error surface to UI:** errors are logged in main; the renderer rarely learns why a source failed.
- **Binaries in VCS** (see 2.5).
- **CI absent** — no GitHub Actions for typecheck/test/build despite `GITHUB_SETUP.md`.

---

## 4. Business Analysis

### 4.1 Current business model
**There is none.** MIT-licensed, free, local, no telemetry, no billing, no accounts. It is a portfolio/utility app, not a product yet.

### 4.2 Value proposition (as-is)
"Know exactly when the next monitoring screenshot lands, and disappear before it does." High *felt* value to the monitored individual; **negative** value to the employer/platform doing the monitoring.

### 4.3 TAM by positioning
- **As surveillance-evasion (current):** large latent demand but unsellable through legitimate B2B/enterprise channels; consumer-only, grey-market, word-of-mouth; app stores (Microsoft Store, Mac App Store) likely **reject** it; high churn, no defensible moat.
- **As legitimate focus/time-awareness tool (pivot):** crowded but billion-dollar-adjacent productivity market; sellable B2B and B2C; app-store friendly; defensible via integrations + analytics.

### 4.4 Risk: the positioning problem (must read)
The README repeatedly insists it "never modifies, hooks, blocks, or evades any screenshot software" — and that's **true at the code level** (it's genuinely passive). But the *feature intent* (lead-time warning + content-protection + auto-hide timed to the capture) is unambiguously about **defeating the purpose** of monitoring screenshots. Consequences:
- **Legal/contractual:** end-users may violate employment agreements; if marketed for that purpose, vendor liability and platform-TOS issues arise.
- **Distribution:** Mac App Store / MS Store / corporate MDM will block "anti-monitoring" tooling.
- **Brand:** impossible to sell to the exact buyers (employers) who purchase productivity software at scale.

**Recommendation:** Decide deliberately. The strongest commercial move is to **pivot the narrative and the feature emphasis** toward legitimate cadence/focus use-cases (presentation prep, screen-recording cleanliness, deep-work intervals, break reminders, "camera-ready" overlays for streamers) while keeping the engine. The auto-hide/content-protection features remain valid for **legitimate privacy** (e.g. hide a personal widget from a work screen-share). See Section 20 roadmap for the two-track plan.

### 4.5 Pricing options (post-pivot)
- Free local tier (current).
- **Pro ($3–6/mo):** cloud sync, cross-device, advanced analytics, multiple timers, integrations.
- **Teams ($/seat):** shared cadences, admin dashboard, SSO — *only viable on the legitimate-positioning track.*

---

## 5. Market Research (competitor landscape)

> Web research was not executed in this pass; the following is a structured map to validate. Treat as a research **plan + hypotheses**, not verified citations.

**Adjacent / indirect competitors by the legitimate framing:**
- **Focus/Pomodoro overlays:** Forest, Be Focused, Pomofocus, Flow, Session, Focus Bear.
- **Floating desktop widgets / always-on-top timers:** Toggl Track desktop, Clockify, RescueTime, Stretchly (break reminders), Tomighty.
- **Deep-work / time-awareness:** Rize.io (AI time tracking), Sunsama, Motion, Reclaim.ai.
- **Screen-recording/presentation prep:** Cleanshot X, Presentify, mmhmm.

**The monitoring side (the "other half" of the market — potential partners or adversaries):** Hubstaff, Time Doctor, Insightful (ex-Workpuls), ActivTrak, Teramind, TopTracker, Upwork desktop. SnapCast is *complementary tooling around* these, not a competitor to them.

**Open-source alternatives:** generic Electron timer widgets, Stretchly (MIT break reminder) — none combine prediction + overlay + capture-exclusion the way SnapCast does. **That combination is genuinely novel.**

**Research to run (Phase 2 deliverable):** scrape G2/Capterra reviews of Hubstaff/RescueTime/Rize for top complaints; Reddit r/freelance, r/productivity, r/digitalnomad threads; Product Hunt launches of focus overlays; HN "Show HN" timer/overlay posts for traction signals.

---

## 6. Competitor Comparison (capability matrix)

| Capability | SnapCast | Rize/RescueTime | Stretchly | Hubstaff (monitor) |
|---|---|---|---|---|
| Always-on-top floating overlay | ✅ | ⚠️ menubar | ⚠️ fullscreen break | ❌ |
| Predicts a future cadence event | ✅ (unique) | ❌ | ⚠️ fixed | ✅ (it owns the cadence) |
| Hide from screen capture | ✅ | ❌ | ❌ | n/a |
| Cloud sync / multi-device | ❌ | ✅ | ❌ | ✅ |
| Team/admin dashboard | ❌ | ✅ | ❌ | ✅ |
| AI insights | ❌ | ✅ | ❌ | ⚠️ |
| Integrations (calendar, Slack…) | ❌ | ✅ | ❌ | ✅ |
| Local-first privacy | ✅ | ❌ | ✅ | ❌ |
| Price | Free | $$ | Free | $$$ |

**SnapCast's unique cells:** prediction + overlay + capture-exclusion + local-first. Everything in the "❌" column is the build-out backlog.

---

## 7. Human Pain Points (manual work the software could eliminate)

Framed for the **legitimate pivot** (focus/cadence/privacy overlay). Each: *workflow → pain → time wasted → impact → software fix → ROI*.

1. **Manually watching a clock to time breaks/context-switches.** Pain: cognitive load. ~Several context glances/hour. Impact: broken flow. Fix: predictive overlay (already core). ROI: high, already built.
2. **Manually entering when an event happened (Manual source).** Pain: tedium, forgetting. Fix: auto-detection (FileWatcher/LogWatcher) + calendar/integration auto-import. ROI: medium.
3. **Manually hiding personal widgets before a screen-share.** Pain: embarrassment risk, forgetting. Fix: content-protection + auto-hide-on-screenshare-detection. ROI: medium-high (genuine privacy use-case).
4. **Re-configuring cadence on every machine.** Pain: repeated setup. Fix: cloud sync of settings. ROI: high for multi-device users.
5. **Manually reading raw interval charts to understand patterns.** Pain: no insight, just data. Fix: AI summary ("your cadence is steady at 10±1 min"). ROI: medium.
6. **No reminders/nudges beyond OS notifications.** Fix: smart, fatigue-aware notification scheduling. ROI: medium.
7. **Manually verifying a folder/log source actually works.** Partly solved by wizard `verify`; extend with live "last detected N s ago" health. ROI: low-medium.
8. **Auditing what the app did/saw** — no history view of detections beyond the event list. Fix: activity log UI. ROI: low.

---

## 8. Missing Modules (think like a SaaS founder)

Grouped; **P** = rough priority (1 highest). "(legit-track only)" = depends on repositioning.

**Core product**
- Multiple concurrent timers/cadences (P1) — today one interval only.
- Real multi-algorithm engine (re-add rolling/weighted/seasonal) (P2).
- Source health & live status dashboard (P2).
- Onboarding/empty-state polish + presets ("Pomodoro 25/5", "10-min cadence") (P1).

**Platform / SaaS (legit-track)**
- Accounts + cloud sync (P2).
- Settings/devices sync, backup/restore (P2).
- Web companion dashboard (P3).
- Licensing / paid tiers / billing (P2).
- Telemetry & product analytics (opt-in) (P2).
- Auto-update channel config (electron-updater is a dep but unconfigured) (P1).

**Intelligence**
- AI insight/summary module (P2).
- Anomaly detection on cadence (P3).
- NL settings ("hide me every 10 minutes for 15 seconds") (P3).

**Integrations**
- Calendar (Google/Outlook) cadence import (P3, legit-track).
- Slack/Teams "do not disturb" sync (P3).
- Screen-share detection (Zoom/Meet/OBS) → auto-hide (P2).
- Plugin/SDK for custom sources (turn `FutureSource` real) (P3).

**Ops/Enterprise (legit-track only)**
- Team workspaces, RBAC, admin (P3).
- SSO/SCIM (P4).
- Audit log, policy engine (P4).

**UX/Platform**
- Mobile companion (P4).
- Localization/i18n (P3).
- Accessibility audit & keyboard map (P2).

---

## 9. AI Opportunities

| # | Opportunity | Technique | Where it plugs in | Value |
|---|---|---|---|---|
| 1 | **Cadence summarizer** ("steady 10±1 min, drifts after 2pm") | LLM over stats/intervals | Analytics page | Insight from data |
| 2 | **Adaptive interval prediction** (non-fixed cadences) | Time-series / EWMA / changepoint detection | Engine (new predictor) | Restores the "learning" promise |
| 3 | **Anomaly / drift detection** | Statistical + small model | Service tick | Trust/alerts |
| 4 | **Natural-language settings** | LLM intent → settings patch | Settings | UX delight, low effort via tool-calling |
| 5 | **Smart notification timing** (avoid fatigue) | Bandit/heuristic | NotificationManager | Fewer ignored alerts |
| 6 | **Screen-share/recording detector** | Vision/OS API heuristics | New source | Real privacy automation |
| 7 | **OCR/visual screenshot detection** | On-device OCR/vision watch of capture folder | FileWatcher upgrade | Better auto-detect |
| 8 | **Chat copilot** ("why did it hide just now?") | RAG over local logs | New panel | Support deflection |

All can run **local-first** (small models / on-device) preserving the privacy promise, with optional cloud for heavier models. For any LLM features, default to the latest Claude models (e.g. Opus 4.8 / Sonnet 4.6) and verify model IDs/pricing via the Anthropic SDK before wiring.

---

## 10. Automation Opportunities

- Auto-detect cadence from observed events instead of manual interval entry.
- Auto-anchor (sync) on first detected event rather than a manual "Sync" press.
- Auto-hide on screen-share start (not just predicted screenshot).
- Auto-import cadence from calendar meetings (hide during recorded calls).
- Auto-update (configure electron-updater + a release feed).
- Auto-generated weekly "focus report".
- Auto-backup settings/events to cloud.
- Auto-recover sources that error (re-arm watcher on failure).

---

## 11. Enterprise Readiness

**Current: ~5%.** It is a single-user desktop app. For the *legitimate* team track, the gaps:

| Capability | Status | Notes |
|---|---|---|
| SSO / SAML / OIDC | ❌ | needs accounts first |
| SCIM provisioning | ❌ | |
| RBAC / ABAC | ❌ | no roles, no server |
| Audit logging | ⚠️ | local append-only `logger` only |
| Data residency / DR / HA | ❌ | no backend |
| Rate limiting / quotas | n/a | no API |
| Encryption at rest | ⚠️ | electron-store plaintext JSON; add encryption key |
| Secrets management | n/a | none yet |
| Tenant isolation | ❌ | single tenant by definition |
| Observability / tracing | ❌ | local logs only |
| SLA / metering / billing | ❌ | |
| Compliance (SOC2/ISO/GDPR/HIPAA) | ❌ | GDPR is reachable since data is local; document it |

**Caveat:** enterprise is only sellable on the legitimate-positioning track (Section 4.4). The surveillance-evasion framing is fundamentally anti-enterprise.

---

## 12. UX Improvements

- First-run onboarding with **preset cadences** (Pomodoro, 10-min, custom) instead of raw seconds field.
- Visible **source health** ("✓ watching ~/Pictures · last detect 4 min ago").
- Surface **errors to the UI** (folder missing, log unreadable) — today they only hit logs.
- Clarify the **two time systems** (stopwatch vs. prediction countdown) — users will confuse them.
- Remove/relabel the non-functional algorithm picker until multi-algorithm returns.
- Add an in-widget **"why is it red?"** affordance (explain risk).
- Keyboard shortcut discoverability (Ctrl/Cmd+Shift+H is hidden).
- Tray menu parity with spec (Restart Learning, Analytics, Settings present — verify all wired).

---

## 13. Security Improvements

Already strong (sandbox, contextIsolation, nav-block, permission-deny, whitelisted preload). Add:
- **Encrypt electron-store** (`encryptionKey`) — events reveal user activity patterns.
- **Signed releases / notarization** (macOS notarize, Windows code-sign) — required for distribution & to avoid SmartScreen/Gatekeeper.
- **CSP** on the renderer HTML.
- **Update integrity:** configure electron-updater with signature verification + a trusted feed.
- **Dependency scanning** (Dependabot/`pnpm audit` in CI).
- **Strip committed binaries** from git history (release artifacts shouldn't be versioned).
- Validate/clamp all IPC inputs in handlers (indices, timestamps, regex from log pattern — a user-supplied regex could ReDoS the log watcher; bound it).

---

## 14. Performance Improvements

- Engine `recordScreenshot` does a full `sort` on every insert — O(n log n) per event; fine at ≤1000 but switch to **insertion into sorted position** (events are near-append-only).
- `getPrediction`/`getStats` recompute intervals from scratch each call (1 Hz + on every event) — **memoize derived stats**, invalidate on mutation.
- Coalesce the two `setInterval` loops into one scheduler tick.
- Debounced bounds persistence already good; consider the same for confidence-trend writes (currently writes to disk every 30 s — acceptable).
- Renderer: confirm `React.memo`/selector usage actually prevents whole-tree repaint on tick (add a render-count test).

---

## 15. Scalability Improvements

- Introduce a **persistence interface** (today: electron-store) so SQLite or a cloud store can drop in.
- **Schema versioning + migrations** (current ad-hoc merge won't handle structural changes).
- Multi-timer data model (array of cadences) — refactor `PredictionSettings` from singular to a collection.
- **Sync service** abstraction (even if backed by a file today) to make cloud later non-invasive.
- Move heavy/AI compute to a worker thread to protect the <1% CPU target.

---

## 16. Analytics Improvements

- Today: interval history, confidence trend, screenshot timeline, risk timeline (Recharts) + capped 500-sample trend.
- Add: **per-day/week aggregation**, cadence stability score, "drift over time," heat-map of detection times, exportable CSV/JSON.
- Add **product analytics** (opt-in, privacy-respecting) so the team learns which features are used — currently **zero usage visibility**.
- Add **AI narrative** layer over the charts (Section 9 #1).

---

## 17. Reporting Improvements

- **Weekly focus/cadence report** (local-generated PDF/HTML, emailed if cloud).
- **Session summaries** on stopwatch stop.
- **Export** event history & analytics.
- **Shareable** (team track) cadence reports for managers — *legit-track only*.

---

## 18. New Modules (consolidated catalog with one-liners)

| Module | One-line purpose | Track |
|---|---|---|
| Multi-Timer Engine | Several cadences at once | Both |
| Adaptive Predictor | Learn non-fixed cadences | Both |
| Cloud Sync | Cross-device settings/events | Legit |
| Accounts & Billing | Tiers, licensing | Legit |
| AI Insights | Summaries, anomalies, NL settings | Both |
| Integrations Hub | Calendar, Slack, Zoom/OBS detect | Both |
| Screen-Share Guard | Auto-hide on share/record | Both (privacy) |
| Plugin/Source SDK | Make `FutureSource` real | Both |
| Telemetry & Analytics | Usage insight (opt-in) | Both |
| Auto-Update Channel | Signed updates | Both |
| Onboarding & Presets | Faster activation | Both |
| Team Workspace + Admin | Shared cadences, RBAC | Legit |
| Mobile Companion | Notifications on phone | Legit |
| Localization (i18n) | Reach non-English users | Both |
| Activity/Audit Log UI | Transparency | Both |

---

## 19. Feature Prioritization (rankings)

**Quick Wins (≤1 wk, high value):** auto-update config · onboarding presets · source health UI · surface errors to UI · strip binaries + add CI · encrypt store.

**High ROI:** multi-timer engine · cloud sync · screen-share auto-hide · AI cadence summary.

**Most Innovative:** predictive overlay (exists) · screen-share guard · NL settings · on-device OCR detection.

**Enterprise Features (legit-track):** SSO · audit log · team workspace · RBAC.

**AI Features:** adaptive predictor · anomaly detection · cadence summarizer · NL settings · copilot.

**Automation Features:** auto-anchor · auto-detect cadence · auto-hide on share · auto-backup · source self-heal.

**Revenue Features:** Pro tier (sync+analytics) · Teams tier · billing/licensing.

**Customer Delight:** desktop-pet cat (already shipped 😺) · smart notifications · weekly report · presets.

**Developer Experience:** CI/CD · full test suite · source SDK · typed IPC (exists) · contributing docs.

**Admin Features:** team dashboard · policy engine · usage metering.

**Security Features:** signed/notarized builds · encrypted store · CSP · regex sandboxing · dep scanning.

**Scalability Features:** persistence interface · schema migrations · sync service · worker-thread compute.

**Future-Ready:** plugin marketplace · mobile · on-device AI · cross-platform parity.

---

## 20. Roadmap

### Track decision (do this first)
Pick **A) Legitimate focus/privacy product** (recommended, larger TAM, sellable) or **B) Keep grey-market utility** (free, niche). The roadmap below assumes **A**, keeping the engine, re-emphasizing legitimate value, and retaining privacy auto-hide for honest screen-share use.

### Phase 0 — Hygiene (1–2 wks)
CI (typecheck/test/build) · remove committed binaries · fix `.md.md` · add IPC contract + source tests · encrypt store · configure + sign auto-updates · align README with reality (algorithms).

### Phase 1 — Product polish (3–6 wks)
Onboarding + presets · multi-timer data model · source health & error surfacing · screen-share auto-hide · accessibility audit · usage telemetry (opt-in).

### Phase 2 — Intelligence (4–8 wks)
Re-add adaptive/rolling/weighted predictors · AI cadence summary & anomaly detection · NL settings via LLM tool-calling.

### Phase 3 — Cloud & monetization (6–10 wks)
Accounts · cloud sync · Pro tier + billing · web companion dashboard · calendar/Slack integrations.

### Phase 4 — Teams/Enterprise (legit-track, 8–12 wks)
Workspaces · RBAC · admin dashboard · audit · SSO · plugin/source SDK + marketplace.

---

## 21. Implementation Strategy (template + 3 worked examples)

**Per-feature template:** Problem · Beneficiary · Priority · Complexity · Dependencies · Backend · Frontend · DB · API · Est. time · Risks · Architecture · Folder layout · Integration points · Testing · Migration.

### Example A — Multi-Timer Engine
- **Problem:** only one cadence supported. **Who:** power users. **Priority:** P1. **Complexity:** M.
- **Deps:** none. **Backend:** refactor `PredictionService` to own a `Map<id, PredictionEngine>`; tick loops over all. **Frontend:** timer list UI, per-timer widget tabs. **DB:** `settings.prediction` → `settings.timers[]`; migration in `mergeSettings`. **API:** `timers:*` IPC channels. **Time:** ~1.5–2 wks. **Risks:** UI complexity in compact mode; migration of old single-timer installs. **Testing:** engine multi-instance tests; migration test. **Migration:** wrap existing single config as `timers[0]`.

### Example B — Cloud Sync (legit-track)
- **Problem:** no cross-device. **Who:** multi-device users / Pro. **Priority:** P2. **Complexity:** L.
- **Deps:** Accounts. **Backend (new):** lightweight API (e.g. Supabase/Firebase or custom) storing settings+events per user; conflict resolution (last-write-wins + version). **Frontend:** sign-in, sync status. **DB:** server table `user_state(user_id, version, blob)`. **API:** REST `/sync`. **Time:** ~3–4 wks. **Risks:** privacy regression (events leave device → make opt-in, encrypted). **Testing:** sync conflict tests. **Migration:** local-first remains default; cloud additive.

### Example C — Screen-Share Guard
- **Problem:** manual hide before sharing. **Who:** everyone privacy-conscious. **Priority:** P2. **Complexity:** M.
- **Backend:** detect active capture/recording (OS APIs, running-process heuristics for Zoom/Meet/OBS). **Frontend:** toggle + status. **DB:** `settings.privacy.autoHideOnShare`. **API:** `privacy:*`. **Time:** ~1.5 wks. **Risks:** detection reliability cross-platform. **Testing:** mock detector. **Migration:** additive setting (default off).

---

## 22. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Positioning/legal** (surveillance-evasion framing) | High | **Severe** | Pivot narrative to focus/privacy (Section 4.4); add clear ToS/use policy |
| App-store / distribution rejection | High (as-is) | High | Repositioning + signed/notarized builds |
| `fs.watch` misses screenshots | Medium | Medium | chokidar or polling fallback |
| Committed binaries bloat / leak | Certain (present) | Low-Med | git history cleanup, .gitignore |
| Plaintext local data | Medium | Medium | encrypt store |
| Spec/README drift erodes trust | Present | Low-Med | align docs, restore features |
| Single-dev bus factor | High | Med | tests + CI + docs |
| No monetization path | Present | Med (business) | tier plan, accounts |
| Cross-platform parity (Linux content-protection no-op) | Present | Low | documented; hotkey fallback exists |
| Privacy regression when adding cloud | Medium | High | opt-in, encrypted, local-first default |

---

## 23. Future Vision (3–5 years)

**Year 1:** Best-in-class **local-first focus & cadence overlay** — multi-timer, adaptive prediction, screen-share privacy guard, AI summaries, signed cross-platform builds, opt-in cloud sync + Pro tier. Clean legitimate positioning.

**Year 2–3:** **Productivity-awareness platform** — calendar/Slack/Zoom integrations, weekly AI reports, anomaly/drift insights, web companion, Teams tier with admin + shared cadences, plugin/source marketplace (the realized `FutureSource`).

**Year 3–5:** **On-device-AI ambient assistant for focus & screen privacy** — local models predicting context switches, NL control, mobile companion, an SDK ecosystem where third parties ship custom "cadence sources" and overlays. The defensible moat becomes the **prediction engine + integration breadth + privacy-first brand**, not the original countdown.

**North-star metric:** weekly active focus sessions per user (engagement) → paid conversion via sync/analytics/teams.

---

### Appendix — Key files referenced
- Engine: `src/shared/engine/{PredictionEngine,statistics,predictors,confidence}.ts`
- Runtime: `electron/main/services/{PredictionService,TimerService}.ts`
- Sources: `electron/main/sources/{index,FileWatcherSource,LogWatcherSource,ManualSource,FutureSource}.ts`
- IPC: `electron/main/ipc/index.ts`, `src/shared/ipc.ts`, `src/shared/preload-api.ts`
- Window/Tray/Notif: `electron/main/{window-manager,tray,notifications,index}.ts`
- Persistence: `electron/main/store.ts` (electron-store)
- Types/contract: `src/shared/types.ts`
- UI: `src/{widgets/FloatingWidget,pages/*,components/*,store/*}.tsx`

> **Methodology note:** Phases 1, 3, 4, 7–23 are derived directly from the codebase. Phase 2/5 market claims are a *research plan with hypotheses* (live web research was not run in this pass) — validate competitor/pricing specifics before acting.

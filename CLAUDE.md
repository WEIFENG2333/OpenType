# CLAUDE.md

This file provides context for AI assistants working on the OpenType codebase.

## Project Overview

OpenType is an Electron desktop app for intelligent voice dictation. It captures microphone audio, transcribes it via STT APIs, then polishes the text using LLM post-processing (removing fillers, fixing repetitions, detecting self-corrections, adding punctuation). It also captures rich context (active window, focused field, clipboard, screen OCR) to improve transcription quality.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 3 + Zustand 4
- **Desktop**: Electron 32 (CommonJS output in `dist-electron/`)
- **Build**: electron-builder 25 for cross-platform packaging
- **CI/CD**: GitHub Actions (`ci.yml` for checks, `release.yml` for packaging on `v*` tags)
- **i18n**: Custom lightweight React Context-based system (no external i18n library)

## Repository Layout

```
electron/                → Electron main process (CommonJS, compiled to dist-electron/)
  main.ts                → App lifecycle, creates windows/tray, registers shortcuts
  preload.ts             → contextBridge exposing electronAPI to renderer
  app-state.ts           → Shared mutable state singleton (windows, services, flags)
  config-store.ts        → JSON file persistence (~/Library/Application Support/OpenType/config.json)
  ipc-handlers.ts        → All ipcMain.handle() registrations (config, pipeline, media, context, etc.)
  stt-service.ts         → STT: protocol-driven dispatch (5 protocols), batch REST + realtime WebSocket
  auto-dict-utils.ts     → Pure functions for auto-dict (skip logic, prompt building) — no Electron deps
  llm-service.ts         → Server-side LLM API calls, prompt builder, smart truncation, VLM calls, term extraction
  context-capture.ts     → CapturedContext interface, macOS/Win/Linux context capture, screen OCR (native screencapture + sips)
  shortcut-manager.ts    → Global hotkey registration, toggleRecording() logic, context capture trigger
  auto-dict.ts           → LLM-driven dictionary learning: pipeline extraction, user edit detection, term persistence
  window-manager.ts      → createMainWindow() + createOverlayWindow()
  tray-manager.ts        → System tray icon + menu
  audio-control.ts       → macOS system audio mute/restore during recording
  auto-updater.ts        → electron-updater integration
  fn-monitor.ts          → macOS Fn key monitoring (child process)

src/                     → React renderer (ESM, bundled by Vite to dist/)
  types/config.ts        → Central types: ProviderConfig, ProviderMeta, STTModelDef, STTProtocol, PROVIDERS, AppConfig, DEFAULT_CONFIG, helper functions (getProviderConfig, getSTTProviderOpts, getLLMProviderOpts, getSTTModelDef, getSTTModelMode, getDefaultBatchProtocol)
  types/electron.d.ts    → Type declarations for window.electronAPI (must match preload.ts)
  stores/configStore.ts  → Zustand store: load, set, update, history CRUD, dictionary CRUD, cross-window sync
  services/              → Dual-mode services (Electron IPC or direct fetch)
    audioRecorder.ts     → WebAudio recording, webm → WAV conversion
    sttService.ts        → Speech-to-Text API calls
    llmService.ts        → LLM post-processing API calls
    pipeline.ts          → Full pipeline orchestrator (STT + LLM)
  hooks/useRecorder.ts   → Recording state machine (idle → recording → processing → idle)
  i18n/                  → Internationalization
    index.ts             → I18nProvider, useTranslation hook, detectLocale
    locales/en.json      → English strings
    locales/zh.json      → Chinese strings (must mirror en.json structure exactly)
  components/
    ui/                  → Primitives: Button, Input, Select, Toggle, Slider, Badge, HotkeyCapture, SettingRow, SettingSection
    layout/              → TitleBar, Sidebar, PageHeader
    recording/           → RecordButton, ResultPanel
  pages/                 → DashboardPage, DictationPage, HistoryPage, DictionaryPage, OverlayPage
    settings/            → SettingsLayout + sub-panels: Provider, General, Hotkey, Audio,
                           ToneRules, Privacy, Context, Advanced

scripts/                 → Utility & test scripts
  # Unit tests (run via `npm test`, no API keys needed)
  test-config-helpers.ts → Provider resolution, STT model mode/protocol, defaults (48 tests)
  test-migration.ts      → Config migration: all edge cases, idempotency (17 tests)
  test-llm-helpers.ts    → Truncation, cursor markers, term parsing (27 tests)
  test-auto-dict.ts      → Skip logic, prompt building (25 tests)
  test-word-count.ts     → CJK/Latin/mixed word counting (23 tests)
  test-i18n.ts           → resolve, interpolate, locale file structure (23 tests)
  # Integration tests (require API keys / network)
  test-api.ts            → API connectivity test
  test-stt.ts            → STT test
  test-pipeline.ts       → Full pipeline test
  test-realtime-providers.ts → Provider config resolution for all STT providers
  test-realtime-stt.ts   → Realtime STT streaming test
  test-stt-connection.ts → STT connection test
  test-dashscope-*.ts    → DashScope-specific model/protocol tests
  test-paraformer-realtime.ts → Paraformer native inference protocol test
  clean-history-base64.ts→ One-time migration: strip base64 from config.json

test-fixtures/             → Test audio files (not committed, .gitignore'd)
  angry.wav                → 3.2s Chinese speech "你是不是觉得我很好欺负" (48kHz PCM16 mono)

build/                   → entitlements.mac.plist (microphone + accessibility permissions)
```

## Two TypeScript Configs (CRITICAL)

| Config | Module | Resolution | Output | Purpose |
|--------|--------|------------|--------|---------|
| `tsconfig.json` | ESNext | bundler | noEmit (Vite handles) | Frontend React code |
| `tsconfig.electron.json` | CommonJS | node | `dist-electron/` | Electron main process |

**Always run both when type-checking**: `npm run typecheck` (runs `tsc --noEmit && tsc -p tsconfig.electron.json --noEmit`)

Running `tsc --noEmit` alone only checks frontend — Electron errors will be missed.

## Common Commands

```bash
npm run dev              # Vite dev server (frontend only, http://localhost:5173)
npm run electron:dev     # Full Electron dev mode (Vite + Electron)
npm run typecheck        # Check BOTH frontend + electron TypeScript
npm test                 # Run all 163 unit tests (6 suites: config, migration, LLM, auto-dict, wordCount, i18n)
npm run check            # typecheck + all unit tests (use before committing)
npm run build            # Build frontend (vite build) + compile electron (tsc)
npm run electron:build   # Full package (build + electron-builder, auto-detects platform)

# API integration tests (require env vars, not run by `npm test`)
SILICONFLOW_KEY=sk-xxx npm run test:api
SILICONFLOW_KEY=sk-xxx npm run test:stt
SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npm run test:pipeline
```

## Key Patterns

### Dual-mode Services
All frontend services check `window.electronAPI` first. If present (running in Electron), they delegate to IPC. Otherwise, they make direct fetch calls. This allows developing the UI in a browser without Electron.

### Config Flow
`src/types/config.ts` is the single source of truth — defines `AppConfig`, `DEFAULT_CONFIG`, `PROVIDERS`, and all helper functions. The Zustand store (`configStore.ts`) loads from Electron IPC or localStorage, and persists changes back on every `set()` call. The Electron-side `config-store.ts` imports `DEFAULT_CONFIG` from the same file (no separate copy). Config is stored at `~/Library/Application Support/OpenType/config.json`.

### Multi-Window Architecture (CRITICAL)
The app has **two BrowserWindows** with separate renderer processes:
- **Main window** — hosts Dashboard, History, Dictionary, Settings pages
- **Overlay window** — transparent, always-on-top pill that shows recording status

Both windows use `useRecorder()` independently. **The Zustand stores are NOT shared** between windows. To keep history in sync, the main process broadcasts `config:history-updated` events via IPC when any window writes history. The `configStore.load()` registers a listener for this event.

### Media Storage
Audio recordings and screenshots are stored as **separate files** in `~/Library/Application Support/OpenType/media/`, NOT inline in config.json. History items store file paths (`audioPath`, `screenshotPath`). IPC channels:
- `media:save` — write base64 to file, returns path
- `media:read` — read file, returns base64
- `media:delete` — delete file

### Provider System (Data-Driven)
Five providers defined in `PROVIDERS` array (`src/types/config.ts`): SiliconFlow (STT+LLM), OpenRouter (LLM only), OpenAI (STT+LLM), DashScope (STT only, batch+streaming), OpenAI-Compatible (STT+LLM, custom endpoint).

Each provider is a `ProviderMeta` entry with `defaultConfig`, model lists, `extraHeaders`, etc. Per-user config lives in `AppConfig.providers: Record<string, ProviderConfig>` where `ProviderConfig = { apiKey, baseUrl, sttModel, llmModel }`.

**STT Model Modes**: Each STT model is `STTModelDef = { id, mode, protocol, label?, sampleRate? }`:
- `mode: 'batch' | 'streaming'` — determines recording behavior (batch = record-then-send, streaming = send-while-recording)
- `protocol: STTProtocol` — determines which code path handles the API call:
  - `'openai-batch'` — POST `/audio/transcriptions` (multipart)
  - `'dashscope-batch'` — POST `/compatible-mode/v1/chat/completions` (input_audio)
  - `'openai-realtime'` — WSS OpenAI Realtime API
  - `'qwen-asr-realtime'` — WSS DashScope Qwen-ASR (OpenAI-compatible)
  - `'paraformer-realtime'` — WSS DashScope native inference (Paraformer/FunASR/Gummy)

`getSTTModelDef(providerId, modelId)` resolves full model definition. `getSTTModelMode()` resolves mode. `getDefaultBatchProtocol(providerId)` handles custom models not in PROVIDERS. All dispatch in stt-service.ts is `switch(protocol)` — zero provider-specific if-else.

Helper functions (`getProviderConfig`, `getSTTProviderOpts`, `getLLMProviderOpts`) resolve config with zero if-else — all driven by the `PROVIDERS` array and `PROVIDER_MAP`. Adding a new provider only requires adding an entry to `PROVIDERS`.

### LLM Prompt Construction (`electron/llm-service.ts`)
The system prompt is dynamically built from:
- Toggle states (filler removal, repetition, self-correction, auto-formatting)
- Output language preference
- Personal dictionary as "Hot Word Table" — LLM prefers these spellings for similar-sounding words
- Active app → tone rule matching
- Context: selected text, field content, clipboard, recent transcriptions, screen OCR
- Smart truncation (`smartTruncate()`) applied to all context fields to cap prompt length

### Context Capture Flow
Context is captured at **hotkey press time** (in `toggleRecording()` in `shortcut-manager.ts`) — BEFORE the overlay steals focus. This preserves the correct active window info. OCR runs in the background while the user speaks: macOS 使用 native `screencapture -R` 按光标所在显示器区域截图 + `sips --resampleWidth 1280` 压缩，跨平台 fallback 为 Electron `desktopCapturer`。OCR 结果在 pipeline 的 `resolveContext()` 中被 await 合并。

### Recording Pipeline (with parallelization)

```
快捷键按下 → shortcut-manager.ts: toggleRecording()
│
├── prepareEditDetection()          ← 快照上次输出状态（不阻塞）
├── state.isRecording = true
├── overlay.send('toggle-recording') ← 通知 overlay 开始录音
│
├── 50ms 后异步:
│   ├── captureFullContext()          ← osascript 获取窗口/输入框上下文
│   │   └── 完成后: runEditDetection()  ← 复用已获取的 context（fire-and-forget）
│   └── if OCR: captureScreenAndOcr() ← 🔄 后台截图+VLM（screencapture + sips 压缩）
│
│   ... 用户说话中（OCR 在后台跑） ...
│
停止录音 → useRecorder.ts: stopRecording()
│
├── recorder.stop() → audioBuffer
├── media:save 保存音频文件
│
└── ⚡ Promise.all([                  ← renderer 端并行
     ├── runPipeline() → IPC pipeline:process
     │   │
     │   └── ⚡ Promise.all([          ← main process 端并行
     │        ├── sttService.transcribe()  ← STT 不等 OCR 完成
     │        └── resolveContext()          ← 等待 context+OCR promises
     │        ])
     │   │
     │   ├── llmService.process(raw, cfg, ctx)   ← LLM 润色（阻塞）
     │   ├── schedulePostPipelineExtraction()     ← 🔄 setImmediate 后台词典学习
     │   └── return result
     │
     └── getLastContext()              ← 获取 context 用于 history
     ])
│
├── typeAtCursor(text)               ← 粘贴到光标 + recordTypedText()
└── addHistoryItem()                 ← 保存历史 + 广播同步
```

**用户实际等待时间** = max(STT, OCR) + LLM。最优情况下 OCR 在录音期间已完成，等待 = STT + LLM。

**不阻塞用户的后台任务**：词典术语提取、编辑检测、历史广播。

**安全阀**：Pipeline 有 60s 超时互斥锁，防止 API 挂起导致永久 busy。

### Auto-Learn Dictionary (`electron/auto-dict.ts`)

LLM 驱动的智能词典学习，3 个渠道，全部后台异步不阻塞 pipeline：

1. **Pipeline 后提取** — `schedulePostPipelineExtraction()`: 用 raw + processed + 截图（如有）一次 LLM 调用提取术语。有截图时走 VLM（`extractTermsWithImage`），无截图时走文本 LLM（`extractTerms`）。`setImmediate` 延迟执行。如果 raw 和 processed 仅有标点/空格差异则跳过。
2. **用户编辑检测** — `prepareEditDetection()` + `runEditDetection()`: 在下次按快捷键时，对比上次输出 vs 当前输入框内容，检测用户手动修正中的术语。复用 `captureFullContext()` 结果避免并发 osascript 冲突。5 分钟超时 + bundleId/fieldRole 校验。
3. **`recordTypedText()`** — 在 `typeAtCursor` 成功后记录输出文本到 `state.lastTypedText`，供下次编辑检测。

提取原则：只学习"用户个人专属、STT 大概率搞错"的词（内部项目名、同事姓名、小众术语），默认返回空数组，max 3 个/次。prompt 中包含已有词典避免重复。

术语来源标记：`source: 'auto-llm'`（pipeline 提取）、`'auto-diff'`（编辑检测）、`'manual'`（手动添加）。

通过 `dictionary:auto-added` IPC 事件实时通知主窗口更新 UI。

### Recording Safeguards
- **10-minute auto-stop**: `startRecording()` sets a 600s timeout that triggers `stopRecording()`
- **Generation tracking**: `generationRef` prevents stale pipeline results from updating UI, but history is **always saved** regardless of staleness
- **All outcomes saved**: success, skipped (no speech), and error all create history entries

---

## Synchronization Checklist (MUST follow when making changes)

### Adding a New IPC Channel

Update these **three files** in lockstep:

1. **`electron/ipc-handlers.ts`** — Register handler: `ipcMain.handle('namespace:action', ...)`
2. **`electron/preload.ts`** — Expose method: `action: (...) => ipcRenderer.invoke('namespace:action', ...)`
3. **`src/types/electron.d.ts`** — Add type: `action: (...) => Promise<ReturnType>`

IPC channel naming convention: `namespace:action` (e.g., `config:get`, `stt:transcribe`, `pipeline:process`).

### Adding a New Config Field

Update these files:

1. **`src/types/config.ts`** — Add to `AppConfig` interface + set default in `DEFAULT_CONFIG` (single source of truth, shared by both frontend and electron)
2. **Settings UI** — Add control in appropriate settings sub-panel
3. **Any service** that reads the field (e.g., `llm-service.ts`, `ipc-handlers.ts`)

### Adding a New Provider

Only one file to edit:

1. **`src/types/config.ts`** — Add entry to `PROVIDERS` array with `ProviderMeta` (id, name, supportsSTT/LLM, model lists, `defaultConfig`). If the provider needs custom headers, set `extraHeaders`. If `supportsSTT`/`supportsLLM` introduces a new id, add it to `STTProviderID`/`LLMProviderID` union type.

Everything else (settings UI, helper functions, config resolution) is data-driven and works automatically.

### Adding a New Context Field

Update these files:

1. **`electron/context-capture.ts`** — Add to `CapturedContext` interface + populate in platform-specific capture functions
2. **`src/types/config.ts`** — Add to `HistoryContext` interface
3. **`src/types/electron.d.ts`** — Add to `getLastContext` return type
4. **`src/hooks/useRecorder.ts`** — Save new field in history item's `context` object (in `buildContext()`)
5. **`electron/llm-service.ts`** — Include in prompt construction (with truncation)
6. **`src/pages/HistoryPage.tsx`** — Display in `DetailModal` component

### Adding UI Text / Translations

Update **both** locale files with identical key structure:

1. **`src/i18n/locales/en.json`** — English strings
2. **`src/i18n/locales/zh.json`** — Chinese strings

Missing keys fall back to English; missing from both shows the raw key string.

i18n key convention: `section.subsection.key` (e.g., `settings.providers.apiKey`).

Usage: `const { t } = useTranslation(); t('history.clipboard', { count: 5 })`.

---

## Code Style & Conventions

### Naming

| What | Convention | Example |
|------|-----------|---------|
| React components | PascalCase files + named export | `Button.tsx` → `export const Button` |
| Hooks | camelCase with `use` prefix | `useRecorder.ts` |
| Services | camelCase files | `sttService.ts`, `pipeline.ts` |
| Electron files | kebab-case | `config-store.ts`, `llm-service.ts` |
| IPC channels | `namespace:action` | `config:get`, `stt:transcribe` |
| Config fields | camelCase | `contextL0Enabled`, `providers` |
| CSS variables | kebab-case | `--slider-track` |
| i18n keys | dot-notation | `settings.providers.apiKey` |

### Component Patterns

- All UI components use `forwardRef` + set `displayName`
- Named exports only (no default exports)
- Variant-based styling via `Record<Variant, string>` objects
- Select uses `createPortal` for dropdown (avoids z-index stacking)
- Event listeners from preload must return cleanup functions

### Tailwind / Styling

- **Custom colors only**: Use `brand-*` (blue, primary) and `surface-*` (warm gray) — NOT default Tailwind colors
- **Dark mode**: class-based (`dark:` prefix), toggled via `<html class="dark">`
- **All components must have both light and dark styles**: `text-surface-800 dark:text-surface-200`
- **No responsive breakpoints** (desktop-only app)
- **Z-index**: portals/dropdowns use `z-[9999]`, modals use `z-50`
- **Drag region**: `.drag-region` for draggable areas, `.no-drag` for interactive elements inside

### Color Reference

```
brand-500  → #3b82f6 (primary blue — buttons, focus rings, active states)
surface-50 → #faf8f5 (light background)
surface-850→ #201e1c (dark component backgrounds)
surface-900→ #181715 (dark page backgrounds)
```

### Electron-specific

- `electron/` uses CommonJS (`module: "CommonJS"`) — **no `import.meta`**, no top-level `export default`
- Preload event listeners (`on*` methods) must return cleanup functions to prevent memory leaks
- Context is captured at hotkey time, not pipeline execution time
- Overlay window is transparent, always-on-top, unfocusable, positioned at bottom-center of active display
- `typeAtCursor` saves/restores clipboard around paste simulation
- IPC handlers are in `ipc-handlers.ts`, NOT in `main.ts`

---

## Common Pitfalls

1. **Forgetting one of the 3 IPC files** — TypeScript may pass, but runtime will crash
2. **Only running `tsc --noEmit`** — Misses electron/ errors. Always use `npm run typecheck`
3. **Hardcoding provider logic** — Never add if-else for specific providers; add entry to `PROVIDERS` array instead
4. **Using `import.meta` in electron/** — Will fail; electron uses CommonJS
5. **Not updating both locale files** — Chinese users see English fallback or raw key strings
6. **Capturing context too late** — Must happen before overlay shows, or you get overlay's window info
7. **Missing `displayName` on forwardRef components** — React DevTools show "ForwardRef" instead of name
8. **Using default Tailwind colors** — Must use `brand-*` and `surface-*` custom scales
9. **History item ID collisions** — Must include randomness: `Date.now().toString(36) + Math.random().toString(36).slice(2, 6)`
10. **Stale closures in useEffect** — Event listener callbacks must track correct dependencies
11. **Storing large data in config.json** — Audio/screenshots must use media files (`media:save` IPC), NOT inline base64
12. **Cross-window state not syncing** — Overlay and main window have separate Zustand stores; history changes must be broadcast via `config:history-updated` IPC event
13. **Adding IPC handlers in main.ts** — All handlers belong in `ipc-handlers.ts`; `main.ts` only does app lifecycle

## Important Notes

- Config stored at `~/Library/Application Support/OpenType/config.json` (Electron `userData`), NOT `~/.opentype/`
- Media files (audio WAV, screenshot JPG) stored in `~/Library/Application Support/OpenType/media/`
- `build/entitlements.mac.plist` grants microphone access (`com.apple.security.device.audio-input`) for macOS
- Audio recording converts webm to WAV (PCM 16-bit, 16kHz) in the browser before sending to STT APIs
- The overlay window is transparent, always-on-top, and unfocusable. It's shown/hidden alongside recording state
- The frameless window uses `-webkit-app-region: drag` via `.drag-region` CSS class. Interactive elements need `.no-drag`
- Config persistence is immediate (no debouncing) — each `set()` writes to disk
- History is capped at 500 items in the Zustand store
- Recording auto-stops after 10 minutes
- Smart truncation in LLM prompts: `selectedText` 500 chars, `fieldText` 1500, `clipboardText` 500, `screenContext` 400, `recentTranscription` 200 each (max 3)

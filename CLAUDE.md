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
  stt-service.ts         → Server-side STT API calls
  llm-service.ts         → Server-side LLM API calls, prompt builder, smart truncation
  context-capture.ts     → CapturedContext interface, macOS/Win/Linux context capture, screen OCR, dictionary term extraction
  shortcut-manager.ts    → Global hotkey registration, toggleRecording() logic, context capture trigger
  window-manager.ts      → createMainWindow() + createOverlayWindow()
  tray-manager.ts        → System tray icon + menu
  audio-control.ts       → macOS system audio mute/restore during recording
  auto-updater.ts        → electron-updater integration
  fn-monitor.ts          → macOS Fn key monitoring (child process)

src/                     → React renderer (ESM, bundled by Vite to dist/)
  types/config.ts        → Central type definitions: AppConfig, HistoryItem, HistoryContext, DEFAULT_CONFIG
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

scripts/                 → Utility scripts
  test-api.ts            → API connectivity test
  test-stt.ts            → STT test
  test-pipeline.ts       → Full pipeline test
  clean-history-base64.ts→ One-time migration: strip base64 from config.json

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
npm run build            # Build frontend (vite build) + compile electron (tsc)
npm run electron:build   # Full package (build + electron-builder, auto-detects platform)

# API tests (require env vars)
SILICONFLOW_KEY=sk-xxx npm run test:api
SILICONFLOW_KEY=sk-xxx npm run test:stt
SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npm run test:pipeline
```

## Key Patterns

### Dual-mode Services
All frontend services check `window.electronAPI` first. If present (running in Electron), they delegate to IPC. Otherwise, they make direct fetch calls. This allows developing the UI in a browser without Electron.

### Config Flow
`src/types/config.ts` defines `AppConfig` with all settings and `DEFAULT_CONFIG`. The Zustand store (`configStore.ts`) loads from Electron IPC or localStorage, and persists changes back on every `set()` call. The Electron-side `config-store.ts` also has a `DEFAULT_CONFIG` for fallback. Config is stored at `~/Library/Application Support/OpenType/config.json`.

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

### Provider System
Four providers: SiliconFlow (STT+LLM), OpenRouter (LLM only), OpenAI (STT+LLM), OpenAI-Compatible (STT+LLM, custom endpoint). Each has configurable API key, base URL, and model. Provider field naming convention: `{provider}ApiKey`, `{provider}BaseUrl`, `{provider}SttModel`, `{provider}LlmModel`.

### LLM Prompt Construction (`electron/llm-service.ts`)
The system prompt is dynamically built from:
- Toggle states (filler removal, repetition, self-correction, auto-formatting)
- Output language preference
- Personal dictionary as "Hot Word Table" — LLM prefers these spellings for similar-sounding words
- Active app → tone rule matching
- Context: selected text, field content, clipboard, recent transcriptions, screen OCR
- Smart truncation (`smartTruncate()`) applied to all context fields to cap prompt length

### Context Capture Flow
Context is captured at **hotkey press time** (in `toggleRecording()` in `shortcut-manager.ts`) — BEFORE the overlay steals focus. This preserves the correct active window info. OCR runs in the background while the user speaks, and its result is awaited when the pipeline retrieves context via `getLastContext`.

### Recording Pipeline
1. User presses hotkey → `shortcut-manager.ts:toggleRecording()` captures context + starts OCR
2. Main process sends `toggle-recording` to overlay window
3. Overlay's `useRecorder` starts audio recording
4. User stops → `stopRecording()` saves audio to media file, calls `processPipeline` IPC
5. Main process: STT transcribe → LLM post-process → auto-learn dictionary terms → returns result
6. Renderer: outputs text (type at cursor or clipboard), saves to history
7. Main process broadcasts history update to other windows

### Auto-Learn Dictionary
After each successful pipeline run (`ipc-handlers.ts`):
1. `extractDictionaryTerms()` scans the LLM output using regex rules (NOT LLM):
   - All-caps 2-6 letters (e.g., `API`, `GRPC`) — abbreviations
   - CamelCase words (e.g., `iPhone`, `gRPC`) — brand/tech names
   - Non-sentence-start capitalized words (e.g., `Kubernetes`) — proper nouns (excludes common words)
2. Max 5 new terms per run, skips existing entries
3. New terms saved with `source: 'auto'`, notified to main window via `dictionary:auto-added`
4. **Limitation**: only works for English patterns; Chinese proper nouns not detected

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

1. **`src/types/config.ts`** — Add to `AppConfig` interface + set default in `DEFAULT_CONFIG`
2. **`electron/config-store.ts`** — Add to electron-side `DEFAULT_CONFIG` (keep in sync)
3. **Settings UI** — Add control in appropriate settings sub-panel
4. **Any service** that reads the field (e.g., `llm-service.ts`, `ipc-handlers.ts`)

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
| Config fields | camelCase | `siliconflowApiKey`, `contextL0Enabled` |
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
3. **Adding config field only to frontend** — Electron-side `config-store.ts` DEFAULT_CONFIG also needs it
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

# CLAUDE.md

This file provides context for AI assistants working on the OpenType codebase.

## Project Overview

OpenType is an Electron desktop app for intelligent voice dictation. It captures microphone audio, transcribes it via STT APIs, then polishes the text using LLM post-processing (removing fillers, fixing repetitions, detecting self-corrections, adding punctuation).

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- **Desktop**: Electron 32 (CommonJS output in `dist-electron/`)
- **Build**: electron-builder for cross-platform packaging
- **CI/CD**: GitHub Actions (`ci.yml` for checks, `release.yml` for packaging on `v*` tags)

## Repository Layout

```
electron/          → Electron main process (CommonJS, compiled to dist-electron/)
  main.ts          → App lifecycle, windows, tray, shortcuts, IPC handlers
  preload.ts       → contextBridge exposing electronAPI
  config-store.ts  → JSON file persistence (~/.opentype/config.json)
  stt-service.ts   → Server-side STT API calls
  llm-service.ts   → Server-side LLM API calls + system prompt builder

src/               → React renderer (ESM, bundled by Vite to dist/)
  types/config.ts  → Central type definitions, AppConfig interface, DEFAULT_CONFIG
  stores/          → Zustand store (configStore.ts)
  services/        → audioRecorder, sttService, llmService, pipeline
  hooks/           → useRecorder (recording state machine)
  components/      → ui/ (Button, Input, Select, Toggle, Slider, Badge)
                     layout/ (TitleBar, Sidebar, PageHeader)
                     recording/ (RecordButton, ResultPanel)
  pages/           → DashboardPage, HistoryPage, DictionaryPage, OverlayPage, FeedbackPage
    settings/      → SettingsLayout + 9 sub-panels (Provider, General, Hotkey, Audio,
                     Personalization, ToneRules, Language, Privacy, Advanced)

scripts/           → Validation scripts (test-api.ts, test-stt.ts, test-pipeline.ts)
```

## Two TypeScript Configs

- `tsconfig.json` — Frontend (ESNext, bundler moduleResolution, noEmit, jsx: react-jsx)
- `tsconfig.electron.json` — Electron (CommonJS, node moduleResolution, output to dist-electron/)

Always run both when type-checking: `npm run typecheck`

## Key Patterns

### Dual-mode Services
All frontend services check `window.electronAPI` first. If present (running in Electron), they delegate to IPC. Otherwise, they make direct fetch calls. This allows developing the UI in a browser without Electron.

### Config Flow
`src/types/config.ts` defines `AppConfig` with all settings and `DEFAULT_CONFIG`. The Zustand store (`configStore.ts`) loads from Electron IPC or localStorage, and persists changes back on every `set()` call.

### Provider System
Three providers: SiliconFlow (STT+LLM), OpenRouter (LLM only), OpenAI (STT+LLM). Each has configurable API key, base URL, and model. Provider metadata is in `PROVIDERS` array in `config.ts`.

### LLM Prompt Construction
The system prompt for post-processing is dynamically built based on:
- Toggle states (filler removal, repetition, self-correction, auto-formatting)
- Output language preference
- Personal dictionary terms
- Active app → tone rule matching
- Personalization sliders (formality, verbosity)

## Common Commands

```bash
npm run dev              # Vite dev server (frontend only)
npm run electron:dev     # Full Electron dev mode
npm run typecheck        # Check both frontend + electron TS
npm run build            # Build frontend + compile electron
npm run electron:build   # Full package (auto-detects platform)

# API tests (require env vars)
SILICONFLOW_KEY=sk-xxx npm run test:api
SILICONFLOW_KEY=sk-xxx npm run test:stt
SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npm run test:pipeline
```

## Important Notes

- The `electron/` directory uses CommonJS (`module: "CommonJS"` in tsconfig.electron.json). Do not use ESM imports like `import.meta`.
- `electron-store` is in dependencies (not devDependencies) because it's needed at runtime.
- The `build/entitlements.mac.plist` grants microphone access (`com.apple.security.device.audio-input`) for macOS.
- Tailwind uses custom color scales: `brand-*` (indigo) and `surface-*` (zinc/gray). Use these instead of default Tailwind colors for consistency.
- The frameless window uses `-webkit-app-region: drag` via `.drag-region` CSS class. Interactive elements need `.no-drag`.
- Audio recording converts webm to WAV (PCM 16-bit, 16kHz) in the browser before sending to STT APIs.
- The overlay window is transparent, always-on-top, and unfocusable. It's shown/hidden alongside recording state.

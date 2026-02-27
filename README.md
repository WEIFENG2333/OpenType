# OpenType

Intelligent voice dictation for desktop. Speak naturally, get polished text.

OpenType captures your voice, converts it to text via STT (Speech-to-Text), then uses LLM post-processing to clean up filler words, fix repetitions, detect self-corrections, and output polished, properly punctuated text.

## How It Works

```
[Microphone] → [STT/ASR] → [Raw Text] → [LLM Post-Processing] → [Polished Text] → [Clipboard/Cursor]
```

**Example:**
- You say: *"嗯 那个 我想说的是 明天的会议 不对 是后天的会议改到周三下午两点"*
- You get: *"后天的会议改到周三下午两点。"*

## Features

- **Two-stage AI pipeline** — STT transcription + LLM cleanup in one flow
- **Multi-provider support** — SiliconFlow, OpenRouter, OpenAI (custom API keys, base URLs, models)
- **Global hotkey** — `Ctrl+Shift+Space` to start/stop recording from any app
- **Floating overlay** — Always-on-top recording indicator with waveform visualization
- **Personal dictionary** — Teach OpenType your proper nouns and terminology
- **App-aware tone** — Automatically adjusts tone based on active app (Slack → casual, Gmail → professional, VS Code → technical)
- **Self-correction detection** — "Monday—no, Tuesday" becomes just "Tuesday"
- **Filler word removal** — Strips um, uh, like, 那个, 嗯, etc.
- **History tracking** — Searchable records with retention policies
- **Personalization** — Formality and verbosity sliders that adapt to your style
- **Cross-platform** — macOS, Windows, Linux

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install

# Start Vite dev server (frontend only, for UI development)
npm run dev

# Start full Electron dev mode
npm run electron:dev
```

### Configure API Keys

Launch the app → Settings → Provider Settings, then enter your API keys:

| Provider | STT | LLM | Get API Key |
|----------|-----|-----|-------------|
| SiliconFlow | Yes | Yes | [siliconflow.cn](https://siliconflow.cn) |
| OpenRouter | - | Yes | [openrouter.ai](https://openrouter.ai) |
| OpenAI | Yes | Yes | [platform.openai.com](https://platform.openai.com) |

### Validate API Connectivity

```bash
# Test LLM APIs
SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npm run test:api

# Test STT endpoint
SILICONFLOW_KEY=sk-xxx npm run test:stt

# Test full pipeline (STT + LLM post-processing)
SILICONFLOW_KEY=sk-xxx OPENROUTER_KEY=sk-or-xxx npm run test:pipeline
```

## Build

```bash
# Type check
npm run typecheck

# Build frontend + Electron
npm run build

# Package for your platform
npm run electron:build:linux   # AppImage + deb
npm run electron:build:mac     # DMG (x64 + arm64)
npm run electron:build:win     # NSIS installer
```

Pre-built binaries are available on the [Releases](https://github.com/WEIFENG2333/OpenType/releases) page.

## Project Structure

```
OpenType/
├── electron/                  # Electron main process
│   ├── main.ts               # Window management, tray, shortcuts, IPC
│   ├── preload.ts            # contextBridge API
│   ├── config-store.ts       # JSON file persistence
│   ├── stt-service.ts        # STT API calls
│   └── llm-service.ts        # LLM API calls + prompt builder
├── src/                       # React frontend (renderer)
│   ├── types/config.ts       # Central type system + defaults
│   ├── stores/configStore.ts # Zustand state management
│   ├── services/             # Audio, STT, LLM, pipeline
│   ├── hooks/useRecorder.ts  # Recording state machine
│   ├── components/           # UI primitives + layout + recording
│   └── pages/                # Dashboard, History, Dictionary,
│       └── settings/         # 9 settings sub-panels
├── scripts/                   # Validation test scripts
├── .github/workflows/         # CI + Release pipelines
└── build/                     # macOS entitlements
```

## Architecture

### Dual-mode Services

All services work in two modes:
- **Electron mode**: Frontend → IPC → Main process → API calls (production)
- **Browser mode**: Frontend → direct fetch (development without Electron)

### Settings Panels

| Panel | Description |
|-------|-------------|
| Provider Settings | API keys, base URLs, model selection, connection test |
| General | Launch on startup, input mode (toggle/push-to-talk), output mode |
| Hotkey | Global shortcut, push-to-talk key, paste-last key |
| Audio | Microphone selection, volume, sound effects, whisper mode |
| Personalization | Formality/verbosity sliders, style match score |
| Tone Rules | Per-app tone mapping (pattern → professional/casual/technical/friendly/custom) |
| Language | Input/output language, multi-language mixing |
| Privacy | History on/off, retention period, clear data |
| Advanced | Toggle individual AI features |

### LLM System Prompt

The post-processing prompt is dynamically built from user settings:

```
Base rules (filler removal, repetition, self-correction, formatting)
+ Output language preference
+ Personalization (formality/verbosity)
+ Personal dictionary terms
+ Tone context (based on active app)
+ Custom tone prompts
```

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Zustand
- **Desktop**: Electron 32, electron-builder
- **STT**: SiliconFlow SenseVoice / OpenAI Whisper
- **LLM**: Qwen, Gemini, GPT, DeepSeek, Llama (via provider APIs)
- **CI/CD**: GitHub Actions (type check, build, cross-platform release)

## License

MIT

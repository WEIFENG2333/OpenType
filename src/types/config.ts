/**
 * Central configuration types for OpenType.
 * All persistent settings flow through this type system.
 */

// ─── Provider Definitions ───────────────────────────────────────────────────

export type STTProviderID = 'siliconflow' | 'openai' | 'openai-compatible';
export type LLMProviderID = 'siliconflow' | 'openrouter' | 'openai' | 'openai-compatible';

export interface ProviderMeta {
  id: string;
  name: string;
  supportsSTT: boolean;
  supportsLLM: boolean;
  fixedBaseUrl: boolean;   // true = hide Base URL field in UI (URL is canonical)
  defaultBaseUrl: string;
  sttModels: string[];
  llmModels: string[];
  vlmModels: string[];     // Vision Language Models (for screen OCR)
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    supportsSTT: true,
    supportsLLM: true,
    fixedBaseUrl: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    sttModels: [
      'FunAudioLLM/SenseVoiceSmall',              // 轻量·极快
    ],
    llmModels: [
      // ── 高性能 ──
      'Pro/moonshotai/Kimi-K2.5',                 // 旗舰 MoE·1T 参数
      'Pro/deepseek-ai/DeepSeek-V3.2',            // 高性能通用
      'Pro/deepseek-ai/DeepSeek-R1',              // 深度推理
      'Qwen/Qwen3-235B-A22B-Instruct-2507',       // Qwen 旗舰 MoE
      // ── 轻量 ──
      'moonshotai/Kimi-K2-Instruct-0905',         // 开源 MoE·强 Agent
      'zai-org/GLM-4.6',                          // 中文优化·200K 上下文
      'Qwen/Qwen3-8B',                            // 轻量·高质
      'Qwen/Qwen2.5-7B-Instruct',                 // 经济通用
    ],
    vlmModels: [
      // ── 高性能 ──
      'Qwen/Qwen3-VL-32B-Instruct',               // 旗舰视觉
      'Qwen/Qwen2.5-VL-72B-Instruct',
      'Qwen/Qwen2.5-VL-32B-Instruct',
      'zai-org/GLM-4.6V',                         // GLM 视觉
      // ── 轻量 ──
      'Qwen/Qwen3-VL-8B-Instruct',
      'Pro/Qwen/Qwen2.5-VL-7B-Instruct',
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    supportsSTT: false,
    supportsLLM: true,
    fixedBaseUrl: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    sttModels: [],
    llmModels: [
      // ── 高性能 ──
      'anthropic/claude-opus-4.6',               // Anthropic 旗舰
      'google/gemini-3.1-pro',                   // Google 旗舰
      'openai/gpt-5.2',                          // OpenAI 旗舰
      'deepseek/deepseek-v3.2',                  // DeepSeek 高性能
      'x-ai/grok-4-fast',                        // xAI 高速 Agent
      // ── 轻量 ──
      'anthropic/claude-sonnet-4.6',             // 性价比首选
      'google/gemini-2.5-flash',                 // 快速通用
      'openai/gpt-5-mini',                       // 轻量 GPT-5
      'deepseek/deepseek-r1',                    // 推理·低成本
    ],
    vlmModels: [
      // ── 高性能 ──
      'google/gemini-3.1-pro',
      'anthropic/claude-opus-4.6',
      'openai/gpt-5.2',
      // ── 轻量 ──
      'google/gemini-2.5-flash',
      'anthropic/claude-sonnet-4.6',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    supportsSTT: true,
    supportsLLM: true,
    fixedBaseUrl: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    sttModels: [
      'gpt-4o-transcribe',                       // 高性能·最准
      'gpt-4o-mini-transcribe',                  // 轻量·低成本
      'whisper-1',                               // 经典稳定
    ],
    llmModels: [
      // ── 高性能 ──
      'gpt-5.2',                                 // 最新旗舰
      'gpt-5',                                   // 通用旗舰
      'o3',                                      // 最强推理
      // ── 轻量 ──
      'gpt-5-mini',                              // 轻量 GPT-5
      'o3-mini',                                 // 轻量推理
    ],
    vlmModels: [
      // ── 高性能 ──
      'gpt-5.2',
      'gpt-5',
      // ── 轻量 ──
      'gpt-5-mini',
    ],
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI 兼容',
    supportsSTT: true,
    supportsLLM: true,
    fixedBaseUrl: false,
    defaultBaseUrl: '',
    sttModels: [
      'gpt-4o-transcribe',
      'gpt-4o-mini-transcribe',
      'whisper-1',
    ],
    llmModels: [
      'gpt-5.2',
      'gpt-5',
      'o3',
      'gpt-5-mini',
      'o3-mini',
    ],
    vlmModels: [
      'gpt-5.2',
      'gpt-5',
      'gpt-5-mini',
    ],
  },
];

// ─── Tone Rules ─────────────────────────────────────────────────────────────

export type TonePreset = 'professional' | 'casual' | 'technical' | 'friendly' | 'custom';

export interface ToneRule {
  appPattern: string;       // substring match on active window title / app name
  tone: TonePreset;
  customPrompt?: string;    // only used when tone === 'custom'
}

// ─── History ────────────────────────────────────────────────────────────────

export type HistoryRetention = 'forever' | '30d' | '7d' | '24h' | '1h';

export interface HistoryContext {
  // L0: Basic window info (no special permissions)
  appName?: string;
  windowTitle?: string;
  bundleId?: string;           // macOS bundle identifier
  url?: string;                // browser URL if applicable

  // L1: Accessibility data (requires accessibility permission)
  selectedText?: string;       // AXSelectedText
  fieldText?: string;          // AXValue — full content of focused input field
  fieldRole?: string;          // AXRole — TextField, TextArea, WebArea, etc.
  fieldRoleDescription?: string; // AXRoleDescription — "text field", "search field", "text area"
  fieldLabel?: string;           // AXDescription or AXTitle — field's accessible label
  fieldPlaceholder?: string;     // AXPlaceholderValue — "Type a message...", "Search..."
  cursorPosition?: number;       // cursor position (from AXSelectedTextRange when length=0)
  selectionRange?: { location: number; length: number }; // AXSelectedTextRange
  numberOfCharacters?: number;   // AXNumberOfCharacters — total chars in field
  insertionLineNumber?: number;  // AXInsertionPointLineNumber — cursor line number

  // Clipboard
  clipboardText?: string;      // clipboard content at capture time

  // Recent transcriptions (last few for continuity context)
  recentTranscriptions?: string[];

  // OCR: Screen analysis
  screenContext?: string;      // VLM description of screen content
  screenshotDataUrl?: string;  // screenshot thumbnail

  // Feature flags at capture time
  contextL0Enabled?: boolean;
  contextL1Enabled?: boolean;
  contextOcrEnabled?: boolean;

  // LLM pipeline
  systemPrompt?: string;       // the system prompt sent to LLM
  sttProvider?: string;        // which STT provider was used
  llmProvider?: string;        // which LLM provider was used
  sttModel?: string;           // STT model name
  llmModel?: string;           // LLM model name

  // Pipeline timing
  sttDurationMs?: number;      // how long STT took
  llmDurationMs?: number;      // how long LLM post-processing took

  // Auto-learned dictionary terms
  autoLearnedTerms?: string[]; // terms auto-added in this transcription
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  rawText: string;
  processedText: string;
  durationMs: number;
  sourceApp?: string;
  windowTitle?: string;
  language?: string;
  wordCount: number;
  audioBase64?: string;      // base64 WAV for replay / retry
  error?: string;            // error message if transcription failed
  context?: HistoryContext;   // full pipeline context for detail view
}

// ─── Dictionary Entry ────────────────────────────────────────────────────────

export interface DictionaryEntry {
  word: string;
  source: 'manual' | 'auto';
  addedAt?: number;  // Unix timestamp ms
}

// ─── Full App Config ────────────────────────────────────────────────────────

export interface AppConfig {
  // Provider selection
  sttProvider: STTProviderID;
  llmProvider: LLMProviderID;

  // SiliconFlow
  siliconflowApiKey: string;
  siliconflowBaseUrl: string;
  siliconflowSttModel: string;
  siliconflowLlmModel: string;

  // OpenRouter
  openrouterApiKey: string;
  openrouterBaseUrl: string;
  openrouterLlmModel: string;

  // OpenAI
  openaiApiKey: string;
  openaiBaseUrl: string;
  openaiSttModel: string;
  openaiLlmModel: string;

  // OpenAI-Compatible (custom endpoint)
  compatibleApiKey: string;
  compatibleBaseUrl: string;
  compatibleSttModel: string;
  compatibleLlmModel: string;

  // General
  theme: 'system' | 'dark' | 'light';
  uiLanguage: string;           // 'auto', 'en', 'zh'
  launchOnStartup: boolean;
  inputMode: 'push-to-talk' | 'toggle';
  alsoWriteClipboard: boolean;

  // Hotkey
  globalHotkey: string;
  pushToTalkKey: string;
  pasteLastKey: string;

  // Audio
  selectedMicrophoneId: string;    // '' = default
  inputVolume: number;             // 0-100
  soundEnabled: boolean;           // play beep on recording start/stop
  muteSystemAudio: boolean;        // mute system audio during recording (macOS)
whisperMode: boolean;
  whisperSensitivity: number;      // 0-100

  // Tone Rules
  toneRules: ToneRule[];
  defaultTone: TonePreset;

  // Privacy
  historyEnabled: boolean;
  historyRetention: HistoryRetention;

  // Advanced
  autoFormatting: boolean;
  selfCorrectionDetection: boolean;
  fillerWordRemoval: boolean;
  repetitionElimination: boolean;

  // Context Awareness
  contextL0Enabled: boolean;       // L0: active window metadata
  contextL1Enabled: boolean;       // L1: selected text via Accessibility
  contextOcrEnabled: boolean;      // Screen OCR via VLM
  contextOcrModel: string;         // VLM model for OCR

  // Auto-learning
  autoLearnDictionary: boolean;    // auto-add corrected terms to dictionary

  // Personal dictionary
  personalDictionary: DictionaryEntry[];

  // History data
  history: HistoryItem[];

  // Stats
  totalWordsThisWeek: number;
  totalTimeSavedSeconds: number;
  averageWPM: number;
  weekStartTimestamp: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  sttProvider: 'siliconflow',
  llmProvider: 'siliconflow',

  siliconflowApiKey: '',
  siliconflowBaseUrl: 'https://api.siliconflow.cn/v1',
  siliconflowSttModel: 'FunAudioLLM/SenseVoiceSmall',
  siliconflowLlmModel: 'Pro/deepseek-ai/DeepSeek-V3.2',

  openrouterApiKey: '',
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  openrouterLlmModel: 'google/gemini-2.5-flash',

  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiSttModel: 'gpt-4o-transcribe',
  openaiLlmModel: 'gpt-5-mini',

  compatibleApiKey: '',
  compatibleBaseUrl: '',
  compatibleSttModel: 'whisper-1',
  compatibleLlmModel: '',

  theme: 'light',
  uiLanguage: 'auto',
  launchOnStartup: false,
  inputMode: 'toggle',
  alsoWriteClipboard: false,

  globalHotkey: 'CommandOrControl+Shift+Space',
  pushToTalkKey: 'CommandOrControl+Shift+R',
  pasteLastKey: 'CommandOrControl+Shift+V',

  selectedMicrophoneId: '',
  inputVolume: 80,
  soundEnabled: true,
  muteSystemAudio: true,
whisperMode: false,
  whisperSensitivity: 50,

  toneRules: [
    { appPattern: 'gmail', tone: 'professional' },
    { appPattern: 'outlook', tone: 'professional' },
    { appPattern: 'slack', tone: 'casual' },
    { appPattern: 'discord', tone: 'friendly' },
    { appPattern: 'vscode', tone: 'technical' },
    { appPattern: 'code', tone: 'technical' },
    { appPattern: 'terminal', tone: 'technical' },
    { appPattern: 'wechat', tone: 'casual' },
  ],
  defaultTone: 'professional',

  historyEnabled: true,
  historyRetention: 'forever',

  autoFormatting: true,
  selfCorrectionDetection: true,
  fillerWordRemoval: true,
  repetitionElimination: true,

  contextL0Enabled: true,
  contextL1Enabled: false,
  contextOcrEnabled: false,
  contextOcrModel: 'Qwen/Qwen2.5-VL-32B-Instruct',

  autoLearnDictionary: true,

  personalDictionary: [],

  history: [],

  totalWordsThisWeek: 0,
  totalTimeSavedSeconds: 0,
  averageWPM: 0,
  weekStartTimestamp: 0,
};

/**
 * Central configuration types for OpenType.
 * All persistent settings flow through this type system.
 */

// ─── Provider Definitions ───────────────────────────────────────────────────

export type STTProviderID = 'siliconflow' | 'openai';
export type LLMProviderID = 'siliconflow' | 'openrouter' | 'openai';

export interface ProviderMeta {
  id: string;
  name: string;
  supportsSTT: boolean;
  supportsLLM: boolean;
  defaultBaseUrl: string;
  sttModels: string[];
  llmModels: string[];
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    supportsSTT: true,
    supportsLLM: true,
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    sttModels: ['FunAudioLLM/SenseVoiceSmall'],
    llmModels: [
      'Qwen/Qwen3-235B-A22B-Instruct-2507',
      'Qwen/Qwen3-30B-A3B-Instruct-2507',
      'deepseek-ai/DeepSeek-V3.2',
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-7B-Instruct',
      'THUDM/GLM-4-9B-0414',
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    supportsSTT: false,
    supportsLLM: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    sttModels: [],
    llmModels: [
      'google/gemini-2.5-flash',
      'google/gemini-2.5-flash-lite',
      'deepseek/deepseek-v3.2',
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-haiku-4.5',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    supportsSTT: true,
    supportsLLM: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    sttModels: ['whisper-1', 'gpt-4o-mini-transcribe'],
    llmModels: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini'],
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

  // General
  theme: 'system' | 'dark' | 'light';
  uiLanguage: string;           // 'auto', 'en', 'zh'
  launchOnStartup: boolean;
  inputMode: 'push-to-talk' | 'toggle';
  outputMode: 'cursor' | 'clipboard';

  // Hotkey
  globalHotkey: string;
  pushToTalkKey: string;
  pasteLastKey: string;

  // Audio
  selectedMicrophoneId: string;    // '' = default
  inputVolume: number;             // 0-100
  recordStartSound: boolean;
  recordEndSound: boolean;
  whisperMode: boolean;
  whisperSensitivity: number;      // 0-100

  // Tone Rules
  toneRules: ToneRule[];
  defaultTone: TonePreset;

  // Language
  inputLanguage: string;           // 'auto' or ISO code
  outputLanguage: string;          // 'auto' = same as input, or language name
  multiLanguageMix: boolean;

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

  // Audio behavior
  autoMuteOnRecord: boolean;       // mute system audio during recording

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
  siliconflowLlmModel: 'Qwen/Qwen2.5-7B-Instruct',

  openrouterApiKey: '',
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  openrouterLlmModel: 'google/gemini-2.5-flash',

  openaiApiKey: '',
  openaiBaseUrl: 'https://api.openai.com/v1',
  openaiSttModel: 'whisper-1',
  openaiLlmModel: 'gpt-4o-mini',

  theme: 'light',
  uiLanguage: 'auto',
  launchOnStartup: false,
  inputMode: 'toggle',
  outputMode: 'cursor',

  globalHotkey: 'CommandOrControl+Shift+Space',
  pushToTalkKey: 'CommandOrControl+Shift+R',
  pasteLastKey: 'CommandOrControl+Shift+V',

  selectedMicrophoneId: '',
  inputVolume: 80,
  recordStartSound: true,
  recordEndSound: true,
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

  inputLanguage: 'auto',
  outputLanguage: 'auto',
  multiLanguageMix: true,

  historyEnabled: true,
  historyRetention: 'forever',

  autoFormatting: true,
  selfCorrectionDetection: true,
  fillerWordRemoval: true,
  repetitionElimination: true,

  contextL0Enabled: true,
  contextL1Enabled: false,
  contextOcrEnabled: false,
  contextOcrModel: 'Qwen/Qwen2-VL-7B-Instruct',

  autoMuteOnRecord: false,
  autoLearnDictionary: true,

  personalDictionary: [],

  history: [],

  totalWordsThisWeek: 0,
  totalTimeSavedSeconds: 0,
  averageWPM: 0,
  weekStartTimestamp: 0,
};

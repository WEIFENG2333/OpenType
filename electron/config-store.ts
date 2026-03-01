import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const DEFAULT_CONFIG: Record<string, any> = {
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
  globalHotkey: 'CommandOrControl+Shift+Space',
  pushToTalkKey: 'CommandOrControl+Shift+R',
  pasteLastKey: 'CommandOrControl+Shift+V',
  soundEnabled: true,
  muteSystemAudio: true,
  personalDictionary: [],
  historyEnabled: true,
  historyRetention: 'forever',
  autoFormatting: true,
  selfCorrectionDetection: true,
  fillerWordRemoval: true,
  repetitionElimination: true,
  toneRules: [],
  defaultTone: 'professional',
  autoLearnDictionary: true,
  history: [],
  totalWordsThisWeek: 0,
};

export class ConfigStore {
  private filePath: string;
  private data: Record<string, any>;
  private _needsSave = false;

  constructor() {
    const userDir = app?.getPath?.('userData') ?? path.join(process.env.HOME || '.', '.opentype');
    this.filePath = path.join(userDir, 'config.json');
    this.data = this.load();
    if (this._needsSave) {
      this.save();
      this._needsSave = false;
    }
  }

  private load(): Record<string, any> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) };
        // Migrate personalDictionary from string[] to DictionaryEntry[]
        if (Array.isArray(raw.personalDictionary) && raw.personalDictionary.length > 0
            && typeof raw.personalDictionary[0] === 'string') {
          raw.personalDictionary = raw.personalDictionary.map((w: string) => ({
            word: w, source: 'manual', addedAt: Date.now(),
          }));
          this._needsSave = true;
        }
        return raw;
      }
    } catch (e) {
      console.error('[ConfigStore] load error:', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[ConfigStore] save error:', e);
    }
  }

  get(key: string): any {
    return this.data[key];
  }

  set(key: string, value: any): void {
    this.data[key] = value;
    this.save();
  }

  getAll(): Record<string, any> {
    return { ...this.data };
  }
}

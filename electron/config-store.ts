import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const DEFAULT_CONFIG: Record<string, any> = {
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
  theme: 'dark',
  uiLanguage: 'auto',
  globalHotkey: 'CommandOrControl+Shift+Space',
  inputLanguage: 'auto',
  outputLanguage: 'auto',
  personalDictionary: [],
  historyEnabled: true,
  historyRetention: 'forever',
  autoFormatting: true,
  selfCorrectionDetection: true,
  fillerWordRemoval: true,
  repetitionElimination: true,
  toneRules: [],
  defaultTone: 'professional',
  history: [],
  totalWordsThisWeek: 0,
};

export class ConfigStore {
  private filePath: string;
  private data: Record<string, any>;

  constructor() {
    const userDir = app?.getPath?.('userData') ?? path.join(process.env.HOME || '.', '.opentype');
    this.filePath = path.join(userDir, 'config.json');
    this.data = this.load();
  }

  private load(): Record<string, any> {
    try {
      if (fs.existsSync(this.filePath)) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) };
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

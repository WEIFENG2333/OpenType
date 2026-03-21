import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { AppConfig, DEFAULT_CONFIG } from '../src/types/config';

export class ConfigStore {
  private filePath: string;
  private data: AppConfig;
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

  private load(): AppConfig {
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
        // Migrate flat provider fields → providers map
        // Always merge old flat fields if they exist (handles partial migration)
        const OLD_PREFIXES: Record<string, { prefix: string; hasStt: boolean; hasLlm: boolean }> = {
          siliconflow: { prefix: 'siliconflow', hasStt: true, hasLlm: true },
          openrouter:  { prefix: 'openrouter', hasStt: false, hasLlm: true },
          openai:      { prefix: 'openai', hasStt: true, hasLlm: true },
          dashscope:   { prefix: 'dashscope', hasStt: true, hasLlm: false },
          'openai-compatible': { prefix: 'compatible', hasStt: true, hasLlm: true },
        };
        if (!raw.providers || typeof raw.providers !== 'object' || Array.isArray(raw.providers)) {
          raw.providers = { ...DEFAULT_CONFIG.providers };
        }
        let hasOldFields = false;
        for (const [id, info] of Object.entries(OLD_PREFIXES)) {
          const oldKey = raw[`${info.prefix}ApiKey`];
          if (oldKey === undefined) continue;
          hasOldFields = true;
          const existing = raw.providers[id] || DEFAULT_CONFIG.providers[id] || { apiKey: '', baseUrl: '', sttModel: '', llmModel: '' };
          raw.providers[id] = {
            apiKey: raw[`${info.prefix}ApiKey`] ?? existing.apiKey,
            baseUrl: raw[`${info.prefix}BaseUrl`] ?? existing.baseUrl,
            sttModel: info.hasStt ? (raw[`${info.prefix}SttModel`] ?? existing.sttModel) : existing.sttModel,
            llmModel: info.hasLlm ? (raw[`${info.prefix}LlmModel`] ?? existing.llmModel) : existing.llmModel,
          };
          // Clean up old flat fields
          delete raw[`${info.prefix}ApiKey`];
          delete raw[`${info.prefix}BaseUrl`];
          if (info.hasStt) delete raw[`${info.prefix}SttModel`];
          if (info.hasLlm) delete raw[`${info.prefix}LlmModel`];
        }
        if (hasOldFields) this._needsSave = true;
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

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.data[key];
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.data[key] = value;
    this.save();
  }

  getAll(): AppConfig {
    return { ...this.data };
  }
}

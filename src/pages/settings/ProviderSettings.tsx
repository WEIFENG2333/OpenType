import { useState } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { PROVIDERS, STTProviderID, LLMProviderID, AppConfig } from '../../types/config';
import { testLLMConnection } from '../../services/llmService';
import { Button, Select, PasswordInput, Input, Badge } from '../../components/ui';
import { useTranslation } from '../../i18n';

// ─── Helper: get provider config fields ─────────────────────────────────────

function getProviderApiKey(config: any, provider: string): string {
  if (provider === 'siliconflow') return config.siliconflowApiKey;
  if (provider === 'openrouter') return config.openrouterApiKey;
  return config.openaiApiKey;
}

function getProviderBaseUrl(config: any, provider: string): string {
  if (provider === 'siliconflow') return config.siliconflowBaseUrl;
  if (provider === 'openrouter') return config.openrouterBaseUrl;
  return config.openaiBaseUrl;
}

type ConfigKey = keyof AppConfig;

function apiKeyField(provider: string): ConfigKey {
  if (provider === 'siliconflow') return 'siliconflowApiKey';
  if (provider === 'openrouter') return 'openrouterApiKey';
  return 'openaiApiKey';
}

function baseUrlField(provider: string): ConfigKey {
  if (provider === 'siliconflow') return 'siliconflowBaseUrl';
  if (provider === 'openrouter') return 'openrouterBaseUrl';
  return 'openaiBaseUrl';
}

// ─── VLM models per provider ─────────────────────────────────────────────────

const VLM_MODELS: Record<string, string[]> = {
  siliconflow: ['Qwen/Qwen2-VL-7B-Instruct', 'Qwen/Qwen2-VL-72B-Instruct'],
  openrouter: ['google/gemini-2.5-flash', 'openai/gpt-4o', 'openai/gpt-4o-mini'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProviderSettings() {
  const { config, set } = useConfigStore();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ category: string; ok: boolean; msg: string } | null>(null);
  const { t } = useTranslation();

  const handleTestLLM = async (category: string) => {
    setTesting(category);
    setTestResult(null);
    try {
      const provider = category === 'stt' ? config.sttProvider : config.llmProvider;
      const r = await testLLMConnection(provider, config);
      setTestResult({ category, ok: r.success, msg: r.success ? (r.text || 'OK') : (r.error || 'Failed') });
    } catch (e: any) {
      setTestResult({ category, ok: false, msg: e.message });
    }
    setTesting(null);
  };

  const sttProviders = PROVIDERS.filter((p) => p.supportsSTT);
  const sttMeta = PROVIDERS.find((p) => p.id === config.sttProvider);
  const llmMeta = PROVIDERS.find((p) => p.id === config.llmProvider);

  // Check if STT and LLM share the same provider
  const sharedProvider = config.sttProvider === config.llmProvider;

  return (
    <div className="space-y-6">
      {/* ── STT (Speech-to-Text) ── */}
      <CategorySection
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
        title={t('settings.providers.sttTitle')}
        tooltip={t('settings.providers.sttTooltip')}
        badge="STT"
      >
        <div className="space-y-3">
          <Select
            label={t('settings.providers.provider')}
            value={config.sttProvider}
            onChange={(e) => set('sttProvider', e.target.value as STTProviderID)}
            options={sttProviders.map((p) => ({ value: p.id, label: p.name }))}
          />
          <PasswordInput
            label={t('settings.providers.apiKey')}
            value={getProviderApiKey(config, config.sttProvider)}
            onChange={(e) => set(apiKeyField(config.sttProvider), e.target.value)}
            placeholder="sk-..."
          />
          <Input
            label={t('settings.providers.baseUrl')}
            value={getProviderBaseUrl(config, config.sttProvider)}
            onChange={(e) => set(baseUrlField(config.sttProvider), e.target.value)}
          />
          {sttMeta && (
            <Select
              label={t('settings.providers.sttModel')}
              value={config.sttProvider === 'siliconflow' ? config.siliconflowSttModel : config.openaiSttModel}
              onChange={(e) => set(config.sttProvider === 'siliconflow' ? 'siliconflowSttModel' : 'openaiSttModel', e.target.value)}
              options={sttMeta.sttModels.map((m) => ({ value: m, label: m }))}
            />
          )}
          <TestButton category="stt" testing={testing} result={testResult} onTest={handleTestLLM} />
        </div>
      </CategorySection>

      <hr className="border-surface-200 dark:border-surface-800/40" />

      {/* ── LLM (Language Model) ── */}
      <CategorySection
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        title={t('settings.providers.llmTitle')}
        tooltip={t('settings.providers.llmTooltip')}
        badge="LLM"
      >
        <div className="space-y-3">
          <Select
            label={t('settings.providers.provider')}
            value={config.llmProvider}
            onChange={(e) => set('llmProvider', e.target.value as LLMProviderID)}
            options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
          />
          {sharedProvider && (
            <p className="text-xs text-surface-500 italic">
              {t('settings.providers.sharedCredentials')}
            </p>
          )}
          <PasswordInput
            label={t('settings.providers.apiKey')}
            value={getProviderApiKey(config, config.llmProvider)}
            onChange={(e) => set(apiKeyField(config.llmProvider), e.target.value)}
            placeholder="sk-..."
          />
          <Input
            label={t('settings.providers.baseUrl')}
            value={getProviderBaseUrl(config, config.llmProvider)}
            onChange={(e) => set(baseUrlField(config.llmProvider), e.target.value)}
          />
          {llmMeta && (
            <ModelInput
              label={t('settings.providers.llmModel')}
              value={
                config.llmProvider === 'siliconflow' ? config.siliconflowLlmModel :
                config.llmProvider === 'openrouter' ? config.openrouterLlmModel :
                config.openaiLlmModel
              }
              onChange={(v) => {
                if (config.llmProvider === 'siliconflow') set('siliconflowLlmModel', v);
                else if (config.llmProvider === 'openrouter') set('openrouterLlmModel', v);
                else set('openaiLlmModel', v);
              }}
              presets={llmMeta.llmModels}
            />
          )}
          <TestButton category="llm" testing={testing} result={testResult} onTest={handleTestLLM} />
        </div>
      </CategorySection>

      <hr className="border-surface-200 dark:border-surface-800/40" />

      {/* ── VLM (Vision Language Model) ── */}
      <CategorySection
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
        title={t('settings.providers.vlmTitle')}
        tooltip={t('settings.providers.vlmTooltip')}
        badge="VLM"
      >
        <div className="space-y-3">
          <p className="text-xs text-surface-500">
            {t('settings.providers.vlmNote')}
          </p>
          <Select
            label={t('settings.providers.vlmModel')}
            value={config.contextOcrModel}
            onChange={(e) => set('contextOcrModel', e.target.value)}
            options={(VLM_MODELS[config.llmProvider] || VLM_MODELS.siliconflow).map((m) => ({ value: m, label: m }))}
          />
        </div>
      </CategorySection>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CategorySection({ icon, title, tooltip, badge, children }: {
  icon: JSX.Element;
  title: string;
  tooltip: string;
  badge: string;
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-brand-500">{icon}</span>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{title}</h3>
        <Badge>{badge}</Badge>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
          {showTooltip && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 px-3 py-2 rounded-lg bg-surface-800 dark:bg-surface-900 text-xs text-surface-200 shadow-lg border border-surface-700">
              {tooltip}
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function ModelInput({ label, value, onChange, presets }: {
  label: string; value: string; onChange: (v: string) => void; presets: string[];
}) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-surface-600 dark:text-surface-400">{label}</label>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Custom model name"
            className="flex-1 bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2 text-sm text-surface-800 dark:text-surface-200 font-mono focus:outline-none focus:border-brand-500"
          />
          <Button variant="ghost" size="sm" onClick={() => setCustom(false)}>{t('settings.providers.presets')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-surface-600 dark:text-surface-400">{label}</label>
      <div className="flex gap-2">
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={presets.map((m) => ({ value: m, label: m }))}
          className="flex-1"
        />
        <Button variant="ghost" size="sm" onClick={() => setCustom(true)}>{t('settings.providers.custom')}</Button>
      </div>
    </div>
  );
}

function TestButton({ category, testing, result, onTest }: {
  category: string;
  testing: string | null;
  result: { category: string; ok: boolean; msg: string } | null;
  onTest: (c: string) => void;
}) {
  const { t } = useTranslation();
  const isMe = testing === category;
  const myResult = result?.category === category ? result : null;

  return (
    <div className="flex items-center gap-3 pt-1">
      <Button variant="secondary" size="sm" onClick={() => onTest(category)} loading={isMe} disabled={isMe}>
        {!isMe && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        {t('settings.providers.testConnection')}
      </Button>
      {myResult && (
        <span className={`text-xs ${myResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {myResult.msg.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

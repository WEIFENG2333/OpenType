import { useState } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { PROVIDERS } from '../../types/config';
import { testLLMConnection } from '../../services/llmService';
import { Button, Select, PasswordInput, Input, Badge } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function ProviderSettings() {
  const { config, set } = useConfigStore();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ provider: string; ok: boolean; msg: string } | null>(null);
  const { t } = useTranslation();

  const handleTest = async (provider: string) => {
    setTesting(provider);
    setTestResult(null);
    try {
      const r = await testLLMConnection(provider, config);
      setTestResult({ provider, ok: r.success, msg: r.success ? (r.text || 'OK') : (r.error || 'Failed') });
    } catch (e: any) {
      setTestResult({ provider, ok: false, msg: e.message });
    }
    setTesting(null);
  };

  const sttProviders = PROVIDERS.filter((p) => p.supportsSTT);

  return (
    <div className="space-y-8">
      {/* Provider selection */}
      <Section title="Provider Selection">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('settings.providers.sttProvider')}
            value={config.sttProvider}
            onChange={(e) => set('sttProvider', e.target.value as any)}
            options={sttProviders.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            label={t('settings.providers.llmProvider')}
            value={config.llmProvider}
            onChange={(e) => set('llmProvider', e.target.value as any)}
            options={PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
          />
        </div>
      </Section>

      <hr className="border-surface-200 dark:border-surface-800/40" />

      {/* SiliconFlow */}
      <Section title="SiliconFlow" badge="STT + LLM">
        <div className="space-y-3">
          <PasswordInput label={t('settings.providers.apiKey')} value={config.siliconflowApiKey} onChange={(e) => set('siliconflowApiKey', e.target.value)} placeholder="sk-..." />
          <Input label={t('settings.providers.baseUrl')} value={config.siliconflowBaseUrl} onChange={(e) => set('siliconflowBaseUrl', e.target.value)} />
          <Select
            label={t('settings.providers.sttModel')}
            value={config.siliconflowSttModel}
            onChange={(e) => set('siliconflowSttModel', e.target.value)}
            options={PROVIDERS.find((p) => p.id === 'siliconflow')!.sttModels.map((m) => ({ value: m, label: m }))}
          />
          <ModelInput
            label={t('settings.providers.llmModel')}
            value={config.siliconflowLlmModel}
            onChange={(v) => set('siliconflowLlmModel', v)}
            presets={PROVIDERS.find((p) => p.id === 'siliconflow')!.llmModels}
          />
          <TestBtn provider="siliconflow" testing={testing} result={testResult} onTest={handleTest} />
        </div>
      </Section>

      <hr className="border-surface-200 dark:border-surface-800/40" />

      {/* OpenRouter */}
      <Section title="OpenRouter" badge="LLM only">
        <div className="space-y-3">
          <PasswordInput label={t('settings.providers.apiKey')} value={config.openrouterApiKey} onChange={(e) => set('openrouterApiKey', e.target.value)} placeholder="sk-or-..." />
          <Input label={t('settings.providers.baseUrl')} value={config.openrouterBaseUrl} onChange={(e) => set('openrouterBaseUrl', e.target.value)} />
          <ModelInput
            label={t('settings.providers.llmModel')}
            value={config.openrouterLlmModel}
            onChange={(v) => set('openrouterLlmModel', v)}
            presets={PROVIDERS.find((p) => p.id === 'openrouter')!.llmModels}
          />
          <TestBtn provider="openrouter" testing={testing} result={testResult} onTest={handleTest} />
        </div>
      </Section>

      <hr className="border-surface-200 dark:border-surface-800/40" />

      {/* OpenAI */}
      <Section title="OpenAI" badge="STT + LLM">
        <div className="space-y-3">
          <PasswordInput label={t('settings.providers.apiKey')} value={config.openaiApiKey} onChange={(e) => set('openaiApiKey', e.target.value)} placeholder="sk-..." />
          <Input label={t('settings.providers.baseUrl')} value={config.openaiBaseUrl} onChange={(e) => set('openaiBaseUrl', e.target.value)} />
          <Select
            label={t('settings.providers.sttModel')}
            value={config.openaiSttModel}
            onChange={(e) => set('openaiSttModel', e.target.value)}
            options={PROVIDERS.find((p) => p.id === 'openai')!.sttModels.map((m) => ({ value: m, label: m }))}
          />
          <ModelInput
            label={t('settings.providers.llmModel')}
            value={config.openaiLlmModel}
            onChange={(v) => set('openaiLlmModel', v)}
            presets={PROVIDERS.find((p) => p.id === 'openai')!.llmModels}
          />
          <TestBtn provider="openai" testing={testing} result={testResult} onTest={handleTest} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{title}</h3>
        {badge && <Badge>{badge}</Badge>}
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

function TestBtn({ provider, testing, result, onTest }: {
  provider: string;
  testing: string | null;
  result: { provider: string; ok: boolean; msg: string } | null;
  onTest: (p: string) => void;
}) {
  const isMe = testing === provider;
  const myResult = result?.provider === provider ? result : null;

  return (
    <div className="flex items-center gap-3 pt-1">
      <Button variant="secondary" size="sm" onClick={() => onTest(provider)} loading={isMe} disabled={isMe}>
        {!isMe && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        Test Connection
      </Button>
      {myResult && (
        <span className={`text-xs ${myResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {myResult.msg.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

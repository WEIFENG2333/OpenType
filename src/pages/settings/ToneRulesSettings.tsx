import { useState } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { TonePreset, ToneRule } from '../../types/config';
import { Button, Select, Badge } from '../../components/ui';
import { useTranslation } from '../../i18n';

const toneOptionKeys = ['professional', 'casual', 'technical', 'friendly', 'custom'] as const;

export function ToneRulesSettings() {
  const { config, set } = useConfigStore();
  const [newApp, setNewApp] = useState('');
  const [newTone, setNewTone] = useState<TonePreset>('professional');
  const { t } = useTranslation();

  const toneOptions = toneOptionKeys.map((k) => ({ value: k, label: t(`settings.tones.${k}`) }));
  const rules = config.toneRules;

  const addRule = () => {
    if (!newApp.trim()) return;
    const updated = [...rules, { appPattern: newApp.trim().toLowerCase(), tone: newTone }];
    set('toneRules', updated);
    setNewApp('');
  };

  const removeRule = (index: number) => {
    const updated = rules.filter((_, i) => i !== index);
    set('toneRules', updated);
  };

  const updateRule = (index: number, field: keyof ToneRule, value: string) => {
    const updated = rules.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    set('toneRules', updated);
  };

  const toneColor: Record<TonePreset, string> = {
    professional: 'text-blue-400',
    casual: 'text-green-400',
    technical: 'text-amber-400',
    friendly: 'text-pink-400',
    custom: 'text-purple-400',
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        {t('settings.tones.description')}
      </p>

      {/* Default tone */}
      <Select
        label={t('settings.tones.defaultTone')}
        value={config.defaultTone}
        onChange={(e) => set('defaultTone', e.target.value as TonePreset)}
        options={toneOptions}
      />

      {/* Rules list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('settings.tones.appRules')}</h3>
        {rules.map((rule, i) => (
          <div key={i} className="flex items-center gap-2 bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2">
            <code className="text-xs text-surface-700 dark:text-surface-300 font-mono flex-1">{rule.appPattern}</code>
            <span className="text-xs text-surface-400 dark:text-surface-600">→</span>
            <select
              value={rule.tone}
              onChange={(e) => updateRule(i, 'tone', e.target.value)}
              className="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded px-2 py-1 text-xs text-surface-700 dark:text-surface-300 focus:outline-none"
            >
              {toneOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {rule.tone === 'custom' && (
              <input
                value={rule.customPrompt || ''}
                onChange={(e) => updateRule(i, 'customPrompt', e.target.value)}
                placeholder={t('settings.tones.customPlaceholder')}
                className="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 rounded px-2 py-1 text-xs text-surface-700 dark:text-surface-300 flex-1 focus:outline-none"
              />
            )}
            <button
              onClick={() => removeRule(i)}
              className="text-surface-400 dark:text-surface-600 hover:text-red-400 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>

      {/* Add new rule */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">{t('settings.tones.appPattern')}</label>
          <input
            value={newApp}
            onChange={(e) => setNewApp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder={t('settings.tones.appPlaceholder')}
            className="w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2 text-sm text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500"
          />
        </div>
        <Select value={newTone} onChange={(e) => setNewTone(e.target.value as TonePreset)} options={toneOptions} />
        <Button variant="primary" onClick={addRule} disabled={!newApp.trim()}>{t('dictionary.add')}</Button>
      </div>
    </div>
  );
}

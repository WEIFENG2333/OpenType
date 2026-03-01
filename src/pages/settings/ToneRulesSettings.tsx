import { useState, useRef, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { TonePreset, ToneRule } from '../../types/config';
import { Select, SettingRow } from '../../components/ui';
import { useTranslation } from '../../i18n';

const toneOptionKeys = ['professional', 'casual', 'technical', 'friendly', 'custom'] as const;

export function ToneRulesSettings() {
  const { config, set } = useConfigStore();
  const [newApp, setNewApp] = useState('');
  const [newTone, setNewTone] = useState<TonePreset>('professional');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { t } = useTranslation();

  const toneOptions = toneOptionKeys.map((k) => ({ value: k, label: t(`settings.tones.${k}`) }));
  const toneLabel = (tone: string) => toneOptions.find((o) => o.value === tone)?.label ?? tone;
  const rules = config.toneRules;

  const addRule = () => {
    if (!newApp.trim()) return;
    set('toneRules', [...rules, { appPattern: newApp.trim().toLowerCase(), tone: newTone }]);
    setNewApp('');
    setNewTone('professional');
  };

  const removeRule = (index: number) => {
    set('toneRules', rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: keyof ToneRule, value: string) => {
    set('toneRules', rules.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-6">
      <SettingRow label={t('settings.tones.defaultTone')} description={t('settings.tones.defaultToneDesc')}>
        <Select
          value={config.defaultTone}
          onChange={(e) => set('defaultTone', e.target.value as TonePreset)}
          options={toneOptions}
        />
      </SettingRow>

      <hr className="border-surface-100 dark:border-surface-800/40" />

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{t('settings.tones.appRules')}</p>
          <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{t('settings.tones.appRulesDesc')}</p>
        </div>

        {/* Add new rule */}
        <div className="flex items-center gap-2">
          <input
            value={newApp}
            onChange={(e) => setNewApp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addRule()}
            placeholder={t('settings.tones.appPlaceholder')}
            className="flex-1 min-w-0 bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500"
          />
          <div className="shrink-0 w-24">
            <Select
              value={newTone}
              onChange={(e) => setNewTone(e.target.value as TonePreset)}
              options={toneOptions}
            />
          </div>
          <button
            onClick={addRule}
            disabled={!newApp.trim()}
            className="shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors
              bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('settings.tones.addRule')}
          </button>
        </div>

        {/* Rules list */}
        {rules.length === 0 ? (
          <p className="text-xs text-surface-400 dark:text-surface-600 py-2">{t('settings.tones.noRules')}</p>
        ) : (
          <div className="space-y-1.5">
            {rules.map((rule, i) => (
              <RuleRow
                key={i}
                rule={rule}
                editing={editingIndex === i}
                onEdit={() => setEditingIndex(i)}
                onClose={() => setEditingIndex(null)}
                toneOptions={toneOptions}
                toneLabel={toneLabel}
                onUpdate={(field, value) => updateRule(i, field, value)}
                onRemove={() => { removeRule(i); setEditingIndex(null); }}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RuleRow({ rule, editing, onEdit, onClose, toneOptions, toneLabel, onUpdate, onRemove, t }: {
  rule: ToneRule;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  toneOptions: { value: string; label: string }[];
  toneLabel: (tone: string) => string;
  onUpdate: (field: keyof ToneRule, value: string) => void;
  onRemove: () => void;
  t: (k: string) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Check if clicking another rule row — let its onClick handle the switch
        const target = e.target as HTMLElement;
        if (target.closest('[data-rule-row]')) return;
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, onClose]);

  if (editing) {
    return (
      <div ref={ref} data-rule-row className="bg-surface-50 dark:bg-surface-850 border border-brand-500/30 rounded-lg px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{rule.appPattern}</span>
          <button
            onClick={onRemove}
            className="text-surface-400 hover:text-red-400 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {toneOptions.map((o) => (
            <button
              key={o.value}
              onClick={() => onUpdate('tone', o.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors
                ${rule.tone === o.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {rule.tone === 'custom' && (
          <input
            value={rule.customPrompt || ''}
            onChange={(e) => onUpdate('customPrompt', e.target.value)}
            placeholder={t('settings.tones.customPlaceholder')}
            className="w-full bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-700 rounded-lg px-3 py-1.5 text-xs text-surface-700 dark:text-surface-300 focus:outline-none focus:border-brand-500"
          />
        )}
      </div>
    );
  }

  return (
    <div
      data-rule-row
      className="group flex items-center justify-between bg-surface-50 dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-lg px-3 py-2 cursor-pointer hover:border-surface-300 dark:hover:border-surface-700 transition-colors"
      onClick={onEdit}
    >
      <span className="text-sm text-surface-700 dark:text-surface-300 min-w-0 truncate">{rule.appPattern}</span>
      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400">
          {toneLabel(rule.tone)}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-400 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useConfigStore } from '../../stores/configStore';
import { PROVIDERS, STTProviderID, LLMProviderID, getProviderConfig, ProviderConfig, STTModelDef } from '../../types/config';
import { testLLMConnection, testVLMConnection, testSTTConnection } from '../../services/llmService';
import { Button, Select, PasswordInput, Input, SettingRow } from '../../components/ui';
import { useTranslation } from '../../i18n';

// ─── Helper: update a single field inside providers[id] ─────────────────────

function useProviderField() {
  const { config, set } = useConfigStore();
  return (providerId: string, field: keyof ProviderConfig, value: string) => {
    const current = getProviderConfig(config, providerId);
    set('providers', {
      ...config.providers,
      [providerId]: { ...current, [field]: value },
    });
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ProviderSettings() {
  const { config, set } = useConfigStore();
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const { t } = useTranslation();
  const setField = useProviderField();

  const handleTest = async (category: string) => {
    setTesting(category);
    setTestResults({});

    if (category === 'llm') {
      const [llmR, vlmR] = await Promise.allSettled([
        testLLMConnection(config.llmProvider, config),
        testVLMConnection(config.llmProvider, config),
      ]);
      const llm = llmR.status === 'fulfilled' ? llmR.value : { success: false, text: undefined, error: String((llmR as any).reason?.message) };
      const vlm = vlmR.status === 'fulfilled' ? vlmR.value : { success: false, text: undefined, error: String((vlmR as any).reason?.message) };
      setTestResults({
        llm: { ok: llm.success, msg: llm.success ? (llm.text ?? 'ok') : (llm.error ?? 'Failed') },
        vlm: { ok: vlm.success, msg: vlm.success ? (vlm.text ?? 'ok') : (vlm.error ?? 'Failed') },
      });
    } else {
      try {
        const r = await testSTTConnection(config.sttProvider, config);
        setTestResults({ stt: { ok: r.success, msg: r.success ? r.text! : (r.error || 'Failed') } });
      } catch (e: any) {
        setTestResults({ stt: { ok: false, msg: e.message } });
      }
    }
    setTesting(null);
  };

  const sttProviders = PROVIDERS.filter((p) => p.supportsSTT);
  const sttMeta = PROVIDERS.find((p) => p.id === config.sttProvider);
  const llmMeta = PROVIDERS.find((p) => p.id === config.llmProvider);
  const sttPC = getProviderConfig(config, config.sttProvider);
  const llmPC = getProviderConfig(config, config.llmProvider);

  return (
    <div className="space-y-6">
      {/* ── STT ── */}
      <ProviderSection
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
        title={t('settings.providers.sttTitle')}
        tooltip={t('settings.providers.sttTooltip')}
      >
        <SettingRow wide label={t('settings.providers.provider')} description={t('settings.providers.providerDesc')}>
          <Select
            value={config.sttProvider}
            onChange={(e) => { set('sttProvider', e.target.value as STTProviderID); setTestResults({}); }}
            options={sttProviders.map((p) => ({ value: p.id, label: p.name }))}
          />
        </SettingRow>

        <SettingRow wide label={t('settings.providers.apiKey')} description={t('settings.providers.apiKeyDesc')}>
          <PasswordInput
            value={sttPC.apiKey}
            onChange={(e) => setField(config.sttProvider, 'apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </SettingRow>

        {!sttMeta?.fixedBaseUrl && (
          <SettingRow wide label={t('settings.providers.baseUrl')} description={t('settings.providers.baseUrlDesc')}>
            <Input
              value={sttPC.baseUrl}
              onChange={(e) => setField(config.sttProvider, 'baseUrl', e.target.value)}
              placeholder="https://..."
            />
          </SettingRow>
        )}

        {sttMeta && (
          <SettingRow wide label={t('settings.providers.sttModel')} description={t('settings.providers.sttModelDesc')}>
            <ModelInput
              value={sttPC.sttModel}
              onChange={(v) => setField(config.sttProvider, 'sttModel', v)}
              presets={sttMeta.sttModels.map(m => m.id)}
              badges={Object.fromEntries(sttMeta.sttModels.map(m => [
                m.id, m.mode === 'streaming' ? 'streaming' : 'batch',
              ]))}
            />
          </SettingRow>
        )}

        <TestRow category="stt" testing={testing} results={testResults} onTest={handleTest} t={t} />
      </ProviderSection>

      <hr className="border-surface-200 dark:border-surface-800/40" />

      {/* ── LLM ── */}
      <ProviderSection
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        title={t('settings.providers.llmTitle')}
        tooltip={t('settings.providers.llmTooltip')}
      >
        <SettingRow wide label={t('settings.providers.provider')} description={t('settings.providers.providerDesc')}>
          <Select
            value={config.llmProvider}
            onChange={(e) => { set('llmProvider', e.target.value as LLMProviderID); setTestResults({}); }}
            options={PROVIDERS.filter((p) => p.supportsLLM).map((p) => ({ value: p.id, label: p.name }))}
          />
        </SettingRow>

        <SettingRow wide label={t('settings.providers.apiKey')} description={t('settings.providers.apiKeyDesc')}>
          <PasswordInput
            value={llmPC.apiKey}
            onChange={(e) => setField(config.llmProvider, 'apiKey', e.target.value)}
            placeholder="sk-..."
          />
        </SettingRow>

        {!llmMeta?.fixedBaseUrl && (
          <SettingRow wide label={t('settings.providers.baseUrl')} description={t('settings.providers.baseUrlDesc')}>
            <Input
              value={llmPC.baseUrl}
              onChange={(e) => setField(config.llmProvider, 'baseUrl', e.target.value)}
              placeholder="https://..."
            />
          </SettingRow>
        )}

        {llmMeta && (
          <SettingRow wide label={t('settings.providers.llmModel')} description={t('settings.providers.llmModelDesc')}>
            <ModelInput
              value={llmPC.llmModel}
              onChange={(v) => setField(config.llmProvider, 'llmModel', v)}
              presets={llmMeta.llmModels}
            />
          </SettingRow>
        )}

        <SettingRow wide label={t('settings.providers.vlmModel')} description={t('settings.providers.vlmModelDesc')}>
          <ModelInput
            value={config.contextOcrModel}
            onChange={(v) => set('contextOcrModel', v)}
            presets={llmMeta?.vlmModels ?? []}
          />
        </SettingRow>

        <TestRow category="llm" testing={testing} results={testResults} onTest={handleTest} t={t} />
      </ProviderSection>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProviderSection({ icon, title, tooltip, children }: {
  icon: JSX.Element;
  title: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-brand-500 shrink-0">{icon}</span>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{title}</h3>
        <div className="relative">
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className="flex items-center justify-center w-5 h-5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
          {showTooltip && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 px-3 py-2 rounded-lg bg-surface-800 dark:bg-surface-900 text-xs text-surface-200 shadow-lg border border-surface-700">
              {tooltip}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

/** Tiny text badge indicating streaming or non-streaming mode */
function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'streaming') {
    return (
      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-brand-500/10 text-brand-600 dark:text-brand-400">
        实时
      </span>
    );
  }
  return null; // non-streaming is the default, no badge needed
}

function ModelInput({ value, onChange, presets, labels, badges }: {
  value: string; onChange: (v: string) => void; presets: string[];
  labels?: Record<string, string>; badges?: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [custom, setCustom] = useState(() => presets.length === 0 || (!!value && !presets.includes(value)));

  useEffect(() => {
    if (presets.length === 0) { setCustom(true); return; }
    if (presets.includes(value)) {
      setCustom(false);
    } else if (value) {
      // Keep user's custom model intact when switching providers
      setCustom(true);
    } else {
      setCustom(false);
      onChange(presets[0]);
    }
  }, [presets]);

  if (custom) {
    return (
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('settings.providers.customModelPlaceholder')}
          className="w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg pl-3 pr-8 py-2 text-sm text-surface-800 dark:text-surface-200 font-mono focus:outline-none focus:border-brand-500"
        />
        {presets.length > 0 && (
          <button
            onClick={() => { setCustom(false); onChange(presets[0]); }}
            title={t('settings.providers.presets')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-brand-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        )}
      </div>
    );
  }

  const selected = presets.includes(value) ? value : presets[0];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!dropOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < 200 && rect.top > spaceBelow;
    const desiredWidth = Math.max(rect.width, 360);
    const maxWidth = window.innerWidth - rect.left - 8;
    const dropWidth = Math.min(desiredWidth, maxWidth);
    setDropStyle({
      position: 'fixed', left: rect.left, width: dropWidth,
      ...(dropUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      maxHeight: Math.min(dropUp ? rect.top - 8 : spaceBelow - 8, 300),
    });
    const onClick = (e: MouseEvent) => {
      if (!triggerRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [dropOpen]);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 min-w-0">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setDropOpen(!dropOpen)}
          className="w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2 text-sm text-surface-800 dark:text-surface-200 text-left flex items-center justify-between focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
        >
          {badges?.[selected] && <ModeBadge mode={badges[selected]} />}
          <span className="truncate font-mono text-xs">{labels?.[selected] ?? selected}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`shrink-0 ml-auto text-surface-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        {dropOpen && createPortal(
          <div ref={dropRef} style={dropStyle}
            className="z-[9999] overflow-y-auto bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl py-1 animate-fade-in">
            {presets.map((m) => (
              <button key={m} onClick={() => { onChange(m); setDropOpen(false); }}
                className={`w-full text-left px-3.5 py-2 text-sm transition-colors flex items-center gap-2
                  ${m === selected
                    ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400'
                    : 'text-surface-800 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800'}`}>
                {badges?.[m] && <ModeBadge mode={badges[m]} />}
                <span className="font-mono text-xs">{labels?.[m] ?? m}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      </div>
      <button
        onClick={() => setCustom(true)}
        title={t('settings.providers.custom')}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-surface-400 hover:text-brand-500 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
  );
}

function ErrorBadge({ label, msg }: { label: string; msg: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const cleanMsg = msg.replace(/^(LLM|VLM|STT)\s+/, '');

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanMsg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-1.5">
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-red-500/10 border border-red-500/20 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span className="text-red-600 dark:text-red-400 font-medium">{label}</span>
        <span className="text-surface-400">·</span>
        <span className="text-surface-500">{t('settings.providers.testError')}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
      </span>
      {expanded && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10">
          <p className="text-[11px] text-surface-600 dark:text-surface-400 break-all leading-relaxed font-mono flex-1 min-w-0">{cleanMsg}</p>
          <button
            onClick={handleCopy}
            className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors
              ${copied
                ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            )}
            {copied ? t('settings.providers.copied') : t('settings.providers.clickToCopy')}
          </button>
        </div>
      )}
    </div>
  );
}

function TestRow({ category, testing, results, onTest, t }: {
  category: string;
  testing: string | null;
  results: Record<string, { ok: boolean; msg: string }>;
  onTest: (c: string) => void;
  t: (k: string) => string;
}) {
  const isMe = testing === category;
  const items: { label: string; ok: boolean; msg: string }[] = category === 'llm'
    ? [
        results.llm ? { label: 'LLM', ...results.llm } : null,
        results.vlm ? { label: 'VLM', ...results.vlm } : null,
      ].filter(Boolean) as { label: string; ok: boolean; msg: string }[]
    : [results.stt ? { label: 'STT', ...results.stt } : null].filter(Boolean) as { label: string; ok: boolean; msg: string }[];

  return (
    <div className="flex items-center gap-3 pt-1 flex-wrap">
      <Button variant="secondary" size="sm" onClick={() => onTest(category)} loading={isMe} disabled={isMe}>
        {!isMe && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        {t('settings.providers.testConnection')}
      </Button>
      {items.map((item) =>
        item.ok ? (
          <span key={item.label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 border border-emerald-500/20">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{item.label}</span>
            <span className="text-surface-400">·</span>
            <span className="text-surface-500 tabular-nums">{item.msg}</span>
          </span>
        ) : (
          <ErrorBadge key={item.label} label={item.label} msg={item.msg} />
        )
      )}
    </div>
  );
}

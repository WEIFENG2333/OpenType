import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function ContextSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();
  const [accessibilityStatus, setAccessibilityStatus] = useState<string>('');
  const [screenStatus, setScreenStatus] = useState<string>('');

  useEffect(() => {
    window.electronAPI?.checkAccessibility().then(setAccessibilityStatus);
    window.electronAPI?.checkScreenPermission().then(setScreenStatus);
  }, []);

  const handleRequestAccessibility = async () => {
    await window.electronAPI?.requestAccessibility();
    // Re-check after a short delay (user may have granted in System Preferences)
    setTimeout(async () => {
      const status = await window.electronAPI?.checkAccessibility();
      if (status) setAccessibilityStatus(status);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        {t('context.description')}
      </p>

      {/* L0: Active Window Detection */}
      <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-500"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('context.activeWindow')}</h3>
        </div>
        <Toggle
          checked={config.contextL0Enabled}
          onChange={(v) => set('contextL0Enabled', v)}
          label={t('context.activeWindowToggle')}
          description={t('context.activeWindowDesc')}
        />
      </div>

      {/* L1: Selected Text */}
      <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-500"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('context.selectedText')}</h3>
        </div>
        <Toggle
          checked={config.contextL1Enabled}
          onChange={(v) => set('contextL1Enabled', v)}
          label={t('context.selectedTextToggle')}
          description={t('context.selectedTextDesc')}
        />

        {config.contextL1Enabled && (
          <PermissionCard
            status={accessibilityStatus}
            label={t('context.accessibilityPermission')}
            grantedText={t('context.permissionGranted')}
            helpText={t('context.accessibilityHelp')}
            onRequest={handleRequestAccessibility}
            requestText={t('context.grantPermission')}
          />
        )}
      </div>

      {/* Auto-Learn Dictionary */}
      <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-500"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('context.autoLearn')}</h3>
        </div>
        <Toggle
          checked={config.autoLearnDictionary}
          onChange={(v) => set('autoLearnDictionary', v)}
          label={t('context.autoLearnToggle')}
          description={t('context.autoLearnDesc')}
        />
      </div>

      {/* Screen OCR */}
      <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-brand-500"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('context.screenOcr')}</h3>
        </div>
        <Toggle
          checked={config.contextOcrEnabled}
          onChange={(v) => set('contextOcrEnabled', v)}
          label={t('context.screenOcrToggle')}
          description={t('context.screenOcrDesc')}
        />

        {config.contextOcrEnabled && (
          <>
            <Select
              label={t('context.vlmModel')}
              value={config.contextOcrModel}
              onChange={(e) => set('contextOcrModel', e.target.value)}
              options={[
                { value: 'Qwen/Qwen2-VL-7B-Instruct', label: 'Qwen2-VL-7B (SiliconFlow)' },
                { value: 'Qwen/Qwen2-VL-72B-Instruct', label: 'Qwen2-VL-72B (SiliconFlow)' },
                { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
                { value: 'gpt-4o-mini', label: 'GPT-4o-mini (OpenAI)' },
              ]}
            />
            <PermissionCard
              status={screenStatus}
              label={t('context.screenPermission')}
              grantedText={t('context.permissionGranted')}
              helpText={t('context.screenHelp')}
            />
          </>
        )}
      </div>
    </div>
  );
}

function PermissionCard({ status, label, grantedText, helpText, onRequest, requestText }: {
  status: string;
  label: string;
  grantedText: string;
  helpText: string;
  onRequest?: () => void;
  requestText?: string;
}) {
  if (status === 'granted') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/10">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
        <span className="text-xs text-green-600 dark:text-green-400">{grantedText}</span>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10 space-y-2">
      <div className="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{label}</span>
      </div>
      <p className="text-[11px] text-surface-500 leading-relaxed">{helpText}</p>
      {onRequest && requestText && (
        <button
          onClick={onRequest}
          className="text-xs font-medium text-brand-500 hover:text-brand-400 transition-colors"
        >
          {requestText} →
        </button>
      )}
    </div>
  );
}

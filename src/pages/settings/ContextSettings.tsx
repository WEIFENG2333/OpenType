import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Toggle } from '../../components/ui';
import { useTranslation } from '../../i18n';

function PermissionBadge({ status, grantedTip, neededTip, onClick }: {
  status: string;
  grantedTip: string;
  neededTip: string;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const granted = status === 'granted';
  const tip = granted ? grantedTip : neededTip;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        onClick={!granted && onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-colors
          ${granted
            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20'
          }`}
        role={!granted && onClick ? 'button' : undefined}
        tabIndex={!granted && onClick ? -1 : undefined}
      >
        {granted ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        )}
      </span>
      {hover && (
        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-1.5 z-50 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-surface-800 dark:bg-surface-900 text-[11px] text-surface-200 shadow-lg border border-surface-700 pointer-events-none">
          {tip}
        </span>
      )}
    </span>
  );
}

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
    setTimeout(async () => {
      const status = await window.electronAPI?.checkAccessibility();
      if (status) setAccessibilityStatus(status);
    }, 1000);
  };

  const handleRequestScreen = async () => {
    await window.electronAPI?.openScreenPrefs();
    // Poll for permission change after user visits settings
    const poll = setInterval(async () => {
      const status = await window.electronAPI?.checkScreenPermission();
      if (status === 'granted') {
        setScreenStatus('granted');
        clearInterval(poll);
      }
    }, 2000);
    setTimeout(() => clearInterval(poll), 30000);
  };

  return (
    <div className="space-y-5">
      <Toggle
        checked={config.contextL0Enabled}
        onChange={(v) => set('contextL0Enabled', v)}
        label={t('context.activeWindowToggle')}
        description={t('context.activeWindowDesc')}
      />

      <Toggle
        checked={config.contextL1Enabled}
        onChange={(v) => set('contextL1Enabled', v)}
        label={t('context.selectedTextToggle')}
        description={t('context.selectedTextDesc')}
        badge={config.contextL1Enabled ? (
          <PermissionBadge
            status={accessibilityStatus}
            grantedTip={t('context.accessibilityGranted')}
            neededTip={t('context.accessibilityNeeded')}
            onClick={handleRequestAccessibility}
          />
        ) : undefined}
      />

      <Toggle
        checked={config.contextOcrEnabled}
        onChange={(v) => set('contextOcrEnabled', v)}
        label={t('context.screenOcrToggle')}
        description={t('context.screenOcrDesc')}
        badge={config.contextOcrEnabled ? (
          <PermissionBadge
            status={screenStatus}
            grantedTip={t('context.screenGranted')}
            neededTip={t('context.screenNeeded')}
            onClick={handleRequestScreen}
          />
        ) : undefined}
      />

      <Toggle
        checked={config.autoLearnDictionary}
        onChange={(v) => set('autoLearnDictionary', v)}
        label={t('context.autoLearnToggle')}
        description={t('context.autoLearnDesc')}
      />
    </div>
  );
}

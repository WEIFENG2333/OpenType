import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle, Button } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function GeneralSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available'>('idle');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    window.electronAPI?.getVersion().then(setCurrentVersion);
    const unsubs = [
      window.electronAPI?.onUpdateAvailable(() => setCheckStatus('available')),
      window.electronAPI?.onUpdateNotAvailable(() => {
        setCheckStatus('up-to-date');
        setTimeout(() => setCheckStatus('idle'), 3000);
      }),
      window.electronAPI?.onUpdateError(() => {
        setCheckStatus('idle');
      }),
    ];
    return () => unsubs.forEach((fn) => fn?.());
  }, []);

  const handleCheckUpdate = async () => {
    setCheckStatus('checking');
    await window.electronAPI?.checkForUpdates();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('settings.general.appearance')}</h3>
        <Select
          value={config.theme}
          onChange={(e) => set('theme', e.target.value as any)}
          options={[
            { value: 'dark', label: t('settings.general.dark') },
            { value: 'light', label: t('settings.general.light') },
            { value: 'system', label: t('settings.general.system') },
          ]}
          hint={t('settings.general.themeHint')}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('settings.general.startup')}</h3>
        <Toggle
          checked={config.launchOnStartup}
          onChange={(v) => set('launchOnStartup', v)}
          label={t('settings.general.launchOnStartup')}
          description={t('settings.general.launchDesc')}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('settings.general.inputMode')}</h3>
        <Select
          value={config.inputMode}
          onChange={(e) => set('inputMode', e.target.value as any)}
          options={[
            { value: 'toggle', label: t('settings.general.toggle') },
            { value: 'push-to-talk', label: t('settings.general.pushToTalk') },
          ]}
          hint={t('settings.general.inputModeHint')}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('settings.general.outputMode')}</h3>
        <Select
          value={config.outputMode}
          onChange={(e) => set('outputMode', e.target.value as any)}
          options={[
            { value: 'cursor', label: t('settings.general.typeAtCursor') },
            { value: 'clipboard', label: t('settings.general.copyToClipboard') },
          ]}
          hint={t('settings.general.outputModeHint')}
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('update.title')}</h3>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            loading={checkStatus === 'checking'}
            onClick={handleCheckUpdate}
          >
            {checkStatus === 'checking' ? t('update.checking') : t('update.checkNow')}
          </Button>
          {checkStatus === 'up-to-date' && (
            <span className="text-xs text-green-600 dark:text-green-400">{t('update.upToDate')}</span>
          )}
          {checkStatus === 'available' && (
            <span className="text-xs text-brand-500">{t('update.newAvailable')}</span>
          )}
        </div>
        {currentVersion && (
          <p className="text-xs text-surface-500 mt-2">{t('update.currentVersion', { version: currentVersion })}</p>
        )}
      </div>
    </div>
  );
}

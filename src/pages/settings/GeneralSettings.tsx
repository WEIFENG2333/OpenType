import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function GeneralSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

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
    </div>
  );
}

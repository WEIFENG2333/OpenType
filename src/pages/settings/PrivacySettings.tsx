import { useConfigStore } from '../../stores/configStore';
import { Toggle, Select, Button } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function PrivacySettings() {
  const { config, set, clearHistory } = useConfigStore();
  const { t } = useTranslation();

  const handleClearAll = () => {
    if (confirm(t('settings.privacy.clearConfirm'))) {
      clearHistory();
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        {t('settings.privacy.privacyDesc')}
      </p>

      <Toggle
        checked={config.historyEnabled}
        onChange={(v) => set('historyEnabled', v)}
        label={t('settings.privacy.saveHistory')}
        description={t('settings.privacy.saveHistoryDesc')}
      />

      {config.historyEnabled && (
        <Select
          label={t('settings.privacy.retention')}
          value={config.historyRetention}
          onChange={(e) => set('historyRetention', e.target.value as any)}
          options={[
            { value: 'forever', label: t('settings.privacy.forever') },
            { value: '30d', label: t('settings.privacy.30d') },
            { value: '7d', label: t('settings.privacy.7d') },
            { value: '24h', label: t('settings.privacy.24h') },
            { value: '1h', label: t('settings.privacy.1h') },
          ]}
          hint={t('settings.privacy.retentionHint')}
        />
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('settings.privacy.dataManagement')}</h3>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handleClearAll}>
            {t('settings.privacy.clearAll')}
          </Button>
        </div>
        <p className="text-xs text-surface-400 dark:text-surface-600">
          {t('settings.privacy.clearAllHint')}
        </p>
      </div>
    </div>
  );
}

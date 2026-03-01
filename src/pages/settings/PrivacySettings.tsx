import { useConfigStore } from '../../stores/configStore';
import { Toggle, Select, Button, SettingRow } from '../../components/ui';
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
    <div className="space-y-5">
      <Toggle
        checked={config.historyEnabled}
        onChange={(v) => set('historyEnabled', v)}
        label={t('settings.privacy.saveHistory')}
        description={t('settings.privacy.saveHistoryDesc')}
      />

      {config.historyEnabled && (
        <SettingRow label={t('settings.privacy.retention')} description={t('settings.privacy.retentionHint')}>
          <Select
            value={config.historyRetention}
            onChange={(e) => set('historyRetention', e.target.value as any)}
            options={[
              { value: 'forever', label: t('settings.privacy.forever') },
              { value: '30d', label: t('settings.privacy.30d') },
              { value: '7d', label: t('settings.privacy.7d') },
              { value: '24h', label: t('settings.privacy.24h') },
              { value: '1h', label: t('settings.privacy.1h') },
            ]}
            className=""
          />
        </SettingRow>
      )}

      <hr className="border-surface-100 dark:border-surface-800/40" />

      <div className="space-y-2">
        <Button variant="secondary" size="sm" onClick={handleClearAll}>
          {t('settings.privacy.clearAll')}
        </Button>
        <p className="text-xs text-surface-400 dark:text-surface-600">
          {t('settings.privacy.clearAllHint')}
        </p>
      </div>
    </div>
  );
}

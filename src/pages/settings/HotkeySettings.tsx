import { useConfigStore } from '../../stores/configStore';
import { HotkeyCapture, SettingRow } from '../../components/ui';
import { AppConfig } from '../../types/config';
import { useTranslation } from '../../i18n';

const HOTKEY_FIELDS: (keyof AppConfig)[] = ['globalHotkey', 'pushToTalkKey', 'pasteLastKey'];

export function HotkeySettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

  const handleChange = (key: keyof AppConfig, value: string) => {
    set(key, value);
    window.electronAPI?.reregisterShortcuts?.();
  };

  const getUsedKeys = (excludeKey: keyof AppConfig) =>
    HOTKEY_FIELDS.filter((k) => k !== excludeKey).map((k) => config[k] as string).filter(Boolean);

  return (
    <div className="divide-y divide-surface-100 dark:divide-surface-800/60">
      <div className="pb-3">
        <SettingRow label={t('settings.hotkey.toggleRecording')} description={t('settings.hotkey.toggleHint')}>
          <HotkeyCapture value={config.globalHotkey} onChange={(v) => handleChange('globalHotkey', v)} usedKeys={getUsedKeys('globalHotkey')} />
        </SettingRow>
      </div>
      <div className="py-3">
        <SettingRow label={t('settings.hotkey.pushToTalkKey')} description={t('settings.hotkey.pushToTalkHint')}>
          <HotkeyCapture value={config.pushToTalkKey} onChange={(v) => handleChange('pushToTalkKey', v)} usedKeys={getUsedKeys('pushToTalkKey')} />
        </SettingRow>
      </div>
      <div className="pt-3">
        <SettingRow label={t('settings.hotkey.pasteLastKey')} description={t('settings.hotkey.pasteLastHint')}>
          <HotkeyCapture value={config.pasteLastKey} onChange={(v) => handleChange('pasteLastKey', v)} usedKeys={getUsedKeys('pasteLastKey')} />
        </SettingRow>
      </div>
    </div>
  );
}

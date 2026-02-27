import { useConfigStore } from '../../stores/configStore';
import { HotkeyCapture } from '../../components/ui';
import { AppConfig } from '../../types/config';
import { useTranslation } from '../../i18n';

export function HotkeySettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

  const handleChange = (key: keyof AppConfig, value: string) => {
    set(key, value);
    window.electronAPI?.reregisterShortcuts?.();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        {t('settings.hotkey.description')}
      </p>

      <HotkeyCapture
        label={t('settings.hotkey.toggleRecording')}
        value={config.globalHotkey}
        onChange={(v) => handleChange('globalHotkey', v)}
        hint={t('settings.hotkey.toggleHint')}
      />

      <HotkeyCapture
        label={t('settings.hotkey.pushToTalkKey')}
        value={config.pushToTalkKey}
        onChange={(v) => handleChange('pushToTalkKey', v)}
        hint={t('settings.hotkey.pushToTalkHint')}
      />

      <HotkeyCapture
        label={t('settings.hotkey.pasteLastKey')}
        value={config.pasteLastKey}
        onChange={(v) => handleChange('pasteLastKey', v)}
        hint={t('settings.hotkey.pasteLastHint')}
      />
    </div>
  );
}

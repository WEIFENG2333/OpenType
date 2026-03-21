import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Select, SettingSection, SettingRow } from '../../components/ui';
import { useTranslation } from '../../i18n';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function AudioSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();
  const [devices, setDevices] = useState<AudioDevice[]>([]);

  useEffect(() => {
    loadBrowserDevices();
  }, []);

  const loadBrowserDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        all
          .filter((d) => d.kind === 'audioinput' && d.label)
          .map((d) => ({ deviceId: d.deviceId, label: d.label }))
      );
    } catch {}
  };

  return (
    <div className="space-y-6">
      <SettingSection
        icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>}
        title={t('settings.audio.microphone')}
      >
        <SettingRow label={t('settings.audio.inputDevice')} description={t('settings.audio.micHint')}>
          <Select
            value={config.selectedMicrophoneId}
            onChange={(e) => set('selectedMicrophoneId', e.target.value)}
            options={[
              { value: '', label: t('settings.audio.autoDetect') },
              ...devices.map((d) => ({ value: d.deviceId, label: d.label })),
            ]}
            className=""
          />
        </SettingRow>
      </SettingSection>

    </div>
  );
}

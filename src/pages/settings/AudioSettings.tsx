import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Toggle, Select } from '../../components/ui';
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
    // Try Electron API first, fall back to browser API
    if (window.electronAPI?.getAudioDevices) {
      window.electronAPI.getAudioDevices().then((devs: AudioDevice[]) => {
        setDevices(devs.filter((d: AudioDevice) => d.deviceId && d.label));
      }).catch(() => loadBrowserDevices());
    } else {
      loadBrowserDevices();
    }
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
      <p className="text-sm text-surface-500">
        {t('settings.audio.description')}
      </p>

      {/* Microphone selection */}
      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
          {t('settings.audio.microphone')}
        </h3>
        <Select
          value={config.selectedMicrophoneId}
          onChange={(e) => set('selectedMicrophoneId', e.target.value)}
          options={[
            { value: '', label: t('settings.audio.autoDetect') },
            ...devices.map((d) => ({ value: d.deviceId, label: d.label })),
          ]}
          hint={t('settings.audio.micHint')}
        />
      </div>

      {/* Sound effects */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
          {t('settings.audio.soundEffects')}
        </h3>
        <Toggle
          checked={config.recordStartSound}
          onChange={(v) => set('recordStartSound', v)}
          label={t('settings.audio.startSound')}
          description={t('settings.audio.startSoundDesc')}
        />
        <Toggle
          checked={config.recordEndSound}
          onChange={(v) => set('recordEndSound', v)}
          label={t('settings.audio.endSound')}
          description={t('settings.audio.endSoundDesc')}
        />
      </div>

      {/* Auto-mute */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
          {t('settings.audio.autoMute')}
        </h3>
        <Toggle
          checked={config.autoMuteOnRecord}
          onChange={(v) => set('autoMuteOnRecord', v)}
          label={t('settings.audio.autoMuteToggle')}
          description={t('settings.audio.autoMuteDesc')}
        />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Toggle } from '../../components/ui';
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
      {/* Microphone selection */}
      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">
          {t('settings.audio.microphone')}
        </h3>
        {devices.length > 0 ? (
          <select
            value={config.selectedMicrophoneId}
            onChange={(e) => set('selectedMicrophoneId', e.target.value)}
            className="w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2.5 text-sm text-surface-800 dark:text-surface-200 focus:outline-none focus:border-brand-500 appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          >
            <option value="">{t('settings.audio.autoDetect')}</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-sm text-surface-500 italic py-2">
            {t('settings.audio.autoDetect')}
          </div>
        )}
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

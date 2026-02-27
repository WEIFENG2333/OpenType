import { useConfigStore } from '../../stores/configStore';
import { Toggle, Slider } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function AudioSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('settings.audio.microphone')}</h3>
        <p className="text-xs text-surface-500 mb-3">
          {t('settings.audio.micHint')}
        </p>
        <input
          value={config.selectedMicrophoneId}
          onChange={(e) => set('selectedMicrophoneId', e.target.value)}
          placeholder={t('settings.audio.micPlaceholder')}
          className="w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-3.5 py-2 text-sm text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500"
        />
      </div>

      <Slider
        label={t('settings.audio.inputVolume')}
        value={config.inputVolume}
        onChange={(v) => set('inputVolume', v)}
        min={0}
        max={100}
        formatValue={(v) => `${v}%`}
      />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('settings.audio.soundEffects')}</h3>
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

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('settings.audio.whisperMode')}</h3>
        <Toggle
          checked={config.whisperMode}
          onChange={(v) => set('whisperMode', v)}
          label={t('settings.audio.enableWhisper')}
          description={t('settings.audio.whisperDesc')}
        />
        {config.whisperMode && (
          <Slider
            label={t('settings.audio.whisperSensitivity')}
            value={config.whisperSensitivity}
            onChange={(v) => set('whisperSensitivity', v)}
            min={0}
            max={100}
            formatValue={(v) => `${v}%`}
          />
        )}
      </div>
    </div>
  );
}

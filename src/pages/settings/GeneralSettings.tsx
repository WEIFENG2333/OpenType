import { useState, useEffect } from 'react';
import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle, Button, SettingRow } from '../../components/ui';
import { useTranslation } from '../../i18n';

interface AudioDevice { deviceId: string; label: string; }

export function GeneralSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();
  const [checkStatus, setCheckStatus] = useState<'idle' | 'checking' | 'up-to-date' | 'available'>('idle');
  const [currentVersion, setCurrentVersion] = useState('');
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);

  useEffect(() => {
    window.electronAPI?.getVersion().then(setCurrentVersion);
    const unsubs = [
      window.electronAPI?.onUpdateAvailable(() => setCheckStatus('available')),
      window.electronAPI?.onUpdateNotAvailable(() => {
        setCheckStatus('up-to-date');
        setTimeout(() => setCheckStatus('idle'), 3000);
      }),
      window.electronAPI?.onUpdateError(() => setCheckStatus('idle')),
    ];
    return () => unsubs.forEach((fn) => fn?.());
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const all = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(all.filter((d) => d.kind === 'audioinput' && d.label).map((d) => ({ deviceId: d.deviceId, label: d.label })));
      } catch {}
    };
    load();
  }, []);

  const handleCheckUpdate = async () => {
    setCheckStatus('checking');
    await window.electronAPI?.checkForUpdates();
  };

  return (
    <div className="space-y-4">
      {/* 外观与语言 */}
      <SettingRow label={t('settings.general.appearance')} description={t('settings.general.themeHint')}>
        <Select
          value={config.theme}
          onChange={(e) => set('theme', e.target.value as any)}
          options={[
            { value: 'dark', label: t('settings.general.dark') },
            { value: 'light', label: t('settings.general.light') },
            { value: 'system', label: t('settings.general.system') },
          ]}
          className=""
        />
      </SettingRow>

      <SettingRow label={t('settings.language.uiLanguage')} description={t('settings.language.uiLanguageHint')}>
        <Select
          value={config.uiLanguage}
          onChange={(e) => set('uiLanguage', e.target.value)}
          options={[
            { value: 'auto', label: t('settings.language.auto') },
            { value: 'en', label: 'English' },
            { value: 'zh', label: '中文' },
          ]}
          className=""
        />
      </SettingRow>

      <Toggle
        checked={config.launchOnStartup}
        onChange={(v) => set('launchOnStartup', v)}
        label={t('settings.general.launchOnStartup')}
        description={t('settings.general.launchDesc')}
      />

      <hr className="border-surface-100 dark:border-surface-800/40" />

      {/* 录音行为 */}
      <SettingRow label={t('settings.general.inputMode')} description={t('settings.general.inputModeHint')}>
        <Select
          value={config.inputMode}
          onChange={(e) => set('inputMode', e.target.value as any)}
          options={[
            { value: 'toggle', label: t('settings.general.toggle') },
            { value: 'push-to-talk', label: t('settings.general.pushToTalk') },
          ]}
          className=""
        />
      </SettingRow>

      <SettingRow label={t('settings.audio.microphone')} description={t('settings.audio.micHint')}>
        <Select
          value={config.selectedMicrophoneId}
          onChange={(e) => set('selectedMicrophoneId', e.target.value)}
          options={[
            { value: '', label: t('settings.audio.autoDetect') },
            ...audioDevices.map((d) => ({ value: d.deviceId, label: d.label })),
          ]}
          className=""
        />
      </SettingRow>

      <Toggle
        checked={config.soundEnabled}
        onChange={(v) => set('soundEnabled', v)}
        label={t('settings.general.soundEnabled')}
        description={t('settings.general.soundEnabledDesc')}
      />

      <Toggle
        checked={config.alsoWriteClipboard}
        onChange={(v) => set('alsoWriteClipboard', v)}
        label={t('settings.general.alsoWriteClipboard')}
        description={t('settings.general.alsoWriteClipboardDesc')}
      />

      <hr className="border-surface-100 dark:border-surface-800/40" />

      {/* 更新 */}
      <div className="space-y-2">
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
          <p className="text-xs text-surface-500">{t('update.currentVersion', { version: currentVersion })}</p>
        )}
      </div>
    </div>
  );
}

import { useConfigStore } from '../../stores/configStore';
import { Toggle } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function AdvancedSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        {t('settings.advanced.description')}
      </p>

      <div className="space-y-4">
        <Toggle
          checked={config.fillerWordRemoval}
          onChange={(v) => set('fillerWordRemoval', v)}
          label={t('settings.advanced.fillerRemoval')}
          description={t('settings.advanced.fillerDesc')}
        />

        <Toggle
          checked={config.repetitionElimination}
          onChange={(v) => set('repetitionElimination', v)}
          label={t('settings.advanced.repetition')}
          description={t('settings.advanced.repetitionDesc')}
        />

        <Toggle
          checked={config.selfCorrectionDetection}
          onChange={(v) => set('selfCorrectionDetection', v)}
          label={t('settings.advanced.selfCorrection')}
          description={t('settings.advanced.selfCorrectionDesc')}
        />

        <Toggle
          checked={config.autoFormatting}
          onChange={(v) => set('autoFormatting', v)}
          label={t('settings.advanced.autoFormat')}
          description={t('settings.advanced.autoFormatDesc')}
        />
      </div>

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-sm text-amber-300 font-medium">{t('settings.advanced.note')}</p>
            <p className="text-sm text-surface-600 dark:text-surface-400 mt-1 leading-relaxed">
              {t('settings.advanced.noteDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

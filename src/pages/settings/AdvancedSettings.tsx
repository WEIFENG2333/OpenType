import { useConfigStore } from '../../stores/configStore';
import { Toggle } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function AdvancedSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <Toggle
        checked={config.llmPostProcessing}
        onChange={(v) => set('llmPostProcessing', v)}
        label={t('settings.advanced.llmPostProcessing')}
        description={t('settings.advanced.llmPostProcessingDesc')}
      />

      {config.llmPostProcessing && (<>
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
      </>)}
    </div>
  );
}

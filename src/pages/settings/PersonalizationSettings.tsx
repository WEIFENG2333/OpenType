import { useConfigStore } from '../../stores/configStore';
import { Toggle, Slider, Button } from '../../components/ui';
import { useTranslation } from '../../i18n';

export function PersonalizationSettings() {
  const { config, set } = useConfigStore();
  const p = config.personalization;
  const { t } = useTranslation();

  const updateP = (key: string, value: any) => {
    set('personalization', { ...p, [key]: value });
  };

  const resetProgress = () => {
    set('personalization', { ...p, totalWordsProcessed: 0, matchScore: 0 });
  };

  return (
    <div className="space-y-6">
      <Toggle
        checked={p.enabled}
        onChange={(v) => updateP('enabled', v)}
        label={t('settings.personalization.enable')}
        description={t('settings.personalization.enableDesc')}
      />

      {p.enabled && (
        <>
          {/* Progress indicator */}
          <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{t('settings.personalization.matchScore')}</span>
              <span className="text-sm font-mono text-brand-400">{p.matchScore}%</span>
            </div>
            <div className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
                style={{ width: `${p.matchScore}%` }}
              />
            </div>
            <p className="text-xs text-surface-500 mt-2">
              {t('settings.personalization.wordsProcessed', { count: p.totalWordsProcessed })}
              {p.matchScore < 30 && t('settings.personalization.keepUsing')}
              {p.matchScore >= 30 && p.matchScore < 70 && t('settings.personalization.gettingBetter')}
              {p.matchScore >= 70 && t('settings.personalization.knowsWell')}
            </p>
          </div>

          {/* Writing style preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">{t('settings.personalization.writingStyle')}</h3>
            <Slider
              label={t('settings.personalization.formality')}
              value={Math.round((p.formalitySetting + 1) * 50)}
              onChange={(v) => updateP('formalitySetting', (v / 50) - 1)}
              min={0}
              max={100}
              formatValue={(v) => v < 30 ? t('settings.personalization.casual') : v > 70 ? t('settings.personalization.formal') : t('settings.personalization.neutral')}
            />
            <Slider
              label={t('settings.personalization.verbosity')}
              value={Math.round((p.verbositySetting + 1) * 50)}
              onChange={(v) => updateP('verbositySetting', (v / 50) - 1)}
              min={0}
              max={100}
              formatValue={(v) => v < 30 ? t('settings.personalization.concise') : v > 70 ? t('settings.personalization.detailed') : t('settings.personalization.balanced')}
            />
          </div>

          <div>
            <Button variant="danger" size="sm" onClick={resetProgress}>
              {t('settings.personalization.reset')}
            </Button>
            <p className="text-xs text-surface-400 dark:text-surface-600 mt-1.5">
              {t('settings.personalization.resetHint')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

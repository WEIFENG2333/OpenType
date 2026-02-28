import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle } from '../../components/ui';
import { useTranslation } from '../../i18n';

const inputLanguages = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'zh', label: 'Chinese (中文)' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese (日本語)' },
  { value: 'ko', label: 'Korean (한국어)' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian (Русский)' },
  { value: 'ar', label: 'Arabic (العربية)' },
];

const outputLanguages = [
  { value: 'auto', label: 'Same as input' },
  { value: 'English', label: 'English' },
  { value: 'Chinese', label: 'Chinese (中文)' },
  { value: 'Japanese', label: 'Japanese (日本語)' },
  { value: 'Korean', label: 'Korean (한국어)' },
  { value: 'French', label: 'French (Français)' },
  { value: 'German', label: 'German (Deutsch)' },
  { value: 'Spanish', label: 'Spanish (Español)' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Russian', label: 'Russian (Русский)' },
];

export function LanguageSettings() {
  const { config, set } = useConfigStore();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        {t('settings.language.description')}
      </p>

      <Select
        label={t('settings.language.uiLanguage')}
        value={config.uiLanguage}
        onChange={(e) => set('uiLanguage', e.target.value)}
        options={[
          { value: 'auto', label: t('settings.language.auto') },
          { value: 'en', label: 'English' },
          { value: 'zh', label: '中文' },
        ]}
        hint={t('settings.language.uiLanguageHint')}
      />

      <hr className="border-surface-200 dark:border-surface-800/40" />

      <Select
        label={t('settings.language.voiceInput')}
        value={config.inputLanguage}
        onChange={(e) => set('inputLanguage', e.target.value)}
        options={inputLanguages}
        hint={t('settings.language.voiceInputHint')}
      />

      <Select
        label={t('settings.language.textOutput')}
        value={config.outputLanguage}
        onChange={(e) => set('outputLanguage', e.target.value)}
        options={outputLanguages}
        hint={t('settings.language.textOutputHint')}
      />

      <Toggle
        checked={config.multiLanguageMix}
        onChange={(v) => set('multiLanguageMix', v)}
        label={t('settings.language.multiLang')}
        description={t('settings.language.multiLangDesc')}
      />

    </div>
  );
}

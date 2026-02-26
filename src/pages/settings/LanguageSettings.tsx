import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle } from '../../components/ui';

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

  return (
    <div className="space-y-6">
      <Select
        label="Voice Input Language"
        value={config.inputLanguage}
        onChange={(e) => set('inputLanguage', e.target.value)}
        options={inputLanguages}
        hint="Auto-detect works well for most languages. Set manually for improved accuracy."
      />

      <Select
        label="Text Output Language"
        value={config.outputLanguage}
        onChange={(e) => set('outputLanguage', e.target.value)}
        options={outputLanguages}
        hint="Set a different language to enable real-time translation (e.g., speak Chinese → output English)"
      />

      <Toggle
        checked={config.multiLanguageMix}
        onChange={(v) => set('multiLanguageMix', v)}
        label="Multi-language Mixing"
        description="Allow mixing multiple languages in a single dictation. The AI will handle code-switching automatically."
      />

      <div className="bg-brand-500/5 border border-brand-500/10 rounded-xl p-4">
        <p className="text-sm text-brand-300 font-medium">Translation mode</p>
        <p className="text-sm text-surface-400 mt-1 leading-relaxed">
          When input and output languages differ, OpenType performs real-time translation.
          The output uses natural, idiomatic phrasing — not mechanical word-for-word translation.
        </p>
      </div>
    </div>
  );
}

import { useConfigStore } from '../../stores/configStore';
import { Toggle, Slider, Button } from '../../components/ui';

export function PersonalizationSettings() {
  const { config, set } = useConfigStore();
  const p = config.personalization;

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
        label="Enable Personalization"
        description="OpenType will learn your speech patterns, vocabulary preferences, and expression habits over time"
      />

      {p.enabled && (
        <>
          {/* Progress indicator */}
          <div className="bg-surface-850 border border-surface-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-surface-300">Style Match Score</span>
              <span className="text-sm font-mono text-brand-400">{p.matchScore}%</span>
            </div>
            <div className="w-full h-2 bg-surface-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
                style={{ width: `${p.matchScore}%` }}
              />
            </div>
            <p className="text-xs text-surface-500 mt-2">
              {p.totalWordsProcessed} words processed.
              {p.matchScore < 30 && ' Keep using OpenType to improve accuracy.'}
              {p.matchScore >= 30 && p.matchScore < 70 && ' Getting better at matching your style.'}
              {p.matchScore >= 70 && ' OpenType knows your communication style well.'}
            </p>
          </div>

          {/* Writing style preferences */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-surface-200">Writing Style</h3>
            <Slider
              label="Formality"
              value={Math.round((p.formalitySetting + 1) * 50)}
              onChange={(v) => updateP('formalitySetting', (v / 50) - 1)}
              min={0}
              max={100}
              formatValue={(v) => v < 30 ? 'Casual' : v > 70 ? 'Formal' : 'Neutral'}
            />
            <Slider
              label="Verbosity"
              value={Math.round((p.verbositySetting + 1) * 50)}
              onChange={(v) => updateP('verbositySetting', (v / 50) - 1)}
              min={0}
              max={100}
              formatValue={(v) => v < 30 ? 'Concise' : v > 70 ? 'Detailed' : 'Balanced'}
            />
          </div>

          <div>
            <Button variant="danger" size="sm" onClick={resetProgress}>
              Reset Personalization Progress
            </Button>
            <p className="text-xs text-surface-600 mt-1.5">
              This will reset the match score and word count but keep your style preferences.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

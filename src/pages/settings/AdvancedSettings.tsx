import { useConfigStore } from '../../stores/configStore';
import { Toggle } from '../../components/ui';

export function AdvancedSettings() {
  const { config, set } = useConfigStore();

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        Fine-tune the AI post-processing pipeline. Each feature can be individually enabled or disabled.
      </p>

      <div className="space-y-4">
        <Toggle
          checked={config.fillerWordRemoval}
          onChange={(v) => set('fillerWordRemoval', v)}
          label="Filler Word Removal"
          description='Automatically remove "um", "uh", "like", "you know", "那个", "嗯" and other meaningless fillers'
        />

        <Toggle
          checked={config.repetitionElimination}
          onChange={(v) => set('repetitionElimination', v)}
          label="Repetition Elimination"
          description='Detect and remove unintentional word/phrase repetitions (e.g., "I I want" → "I want")'
        />

        <Toggle
          checked={config.selfCorrectionDetection}
          onChange={(v) => set('selfCorrectionDetection', v)}
          label="Self-Correction Detection"
          description='Recognize mid-sentence corrections (e.g., "Monday—no, Tuesday") and keep only the final intent'
        />

        <Toggle
          checked={config.autoFormatting}
          onChange={(v) => set('autoFormatting', v)}
          label="Auto Formatting"
          description="Add punctuation, capitalization, and organize spoken lists into structured text"
        />
      </div>

      <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400 flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-sm text-amber-300 font-medium">Note</p>
            <p className="text-sm text-surface-400 mt-1 leading-relaxed">
              Disabling these features means the LLM will do less post-processing.
              The output will be closer to raw transcription. Self-correction detection
              is the most impactful feature for natural dictation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

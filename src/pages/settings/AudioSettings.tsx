import { useConfigStore } from '../../stores/configStore';
import { Toggle, Slider } from '../../components/ui';

export function AudioSettings() {
  const { config, set } = useConfigStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">Microphone</h3>
        <p className="text-xs text-surface-500 mb-3">
          Select your preferred microphone. Leave empty to use the system default.
        </p>
        <input
          value={config.selectedMicrophoneId}
          onChange={(e) => set('selectedMicrophoneId', e.target.value)}
          placeholder="Default system microphone"
          className="w-full bg-surface-850 border border-surface-700 rounded-lg px-3.5 py-2 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-brand-500"
        />
      </div>

      <Slider
        label="Input Volume"
        value={config.inputVolume}
        onChange={(v) => set('inputVolume', v)}
        min={0}
        max={100}
        formatValue={(v) => `${v}%`}
      />

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-200">Sound Effects</h3>
        <Toggle
          checked={config.recordStartSound}
          onChange={(v) => set('recordStartSound', v)}
          label="Recording start sound"
          description="Play a sound when recording begins"
        />
        <Toggle
          checked={config.recordEndSound}
          onChange={(v) => set('recordEndSound', v)}
          label="Recording end sound"
          description="Play a sound when recording ends"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-surface-200">Whisper Mode</h3>
        <Toggle
          checked={config.whisperMode}
          onChange={(v) => set('whisperMode', v)}
          label="Enable Whisper Mode"
          description="Increased sensitivity for quiet environments — speak softly and still be heard"
        />
        {config.whisperMode && (
          <Slider
            label="Whisper Sensitivity"
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

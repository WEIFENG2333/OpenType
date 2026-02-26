import { useConfigStore } from '../../stores/configStore';
import { Select, Toggle } from '../../components/ui';

export function GeneralSettings() {
  const { config, set } = useConfigStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">Startup</h3>
        <Toggle
          checked={config.launchOnStartup}
          onChange={(v) => set('launchOnStartup', v)}
          label="Launch on startup"
          description="Automatically start OpenType when you log in"
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">Input Mode</h3>
        <Select
          value={config.inputMode}
          onChange={(e) => set('inputMode', e.target.value as any)}
          options={[
            { value: 'toggle', label: 'Toggle (press to start / press to stop)' },
            { value: 'push-to-talk', label: 'Push-to-Talk (hold to record)' },
          ]}
          hint="Toggle mode: press hotkey once to start, once to stop. Push-to-Talk: hold the key to record."
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">Output Mode</h3>
        <Select
          value={config.outputMode}
          onChange={(e) => set('outputMode', e.target.value as any)}
          options={[
            { value: 'cursor', label: 'Type at cursor position' },
            { value: 'clipboard', label: 'Copy to clipboard' },
          ]}
          hint="'Type at cursor' simulates keyboard input at the current cursor position. 'Copy to clipboard' copies the result for you to paste."
        />
      </div>
    </div>
  );
}

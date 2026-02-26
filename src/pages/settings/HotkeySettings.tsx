import { useConfigStore } from '../../stores/configStore';
import { Input } from '../../components/ui';

export function HotkeySettings() {
  const { config, set } = useConfigStore();

  return (
    <div className="space-y-6">
      <p className="text-sm text-surface-500">
        Configure global keyboard shortcuts. Use "CommandOrControl" for cross-platform compatibility (maps to Cmd on macOS, Ctrl on Windows/Linux).
        Restart the app after changes.
      </p>

      <Input
        label="Toggle Recording"
        value={config.globalHotkey}
        onChange={(e) => set('globalHotkey', e.target.value)}
        hint="Main shortcut to start/stop dictation"
      />

      <Input
        label="Push-to-Talk Key"
        value={config.pushToTalkKey}
        onChange={(e) => set('pushToTalkKey', e.target.value)}
        hint="Hold this key to record (only in push-to-talk mode)"
      />

      <Input
        label="Paste Last Transcription"
        value={config.pasteLastKey}
        onChange={(e) => set('pasteLastKey', e.target.value)}
        hint="Quickly paste the most recent transcription result"
      />

      <div className="bg-surface-850 border border-surface-800 rounded-xl p-4 text-sm text-surface-400 space-y-2">
        <p className="font-medium text-surface-300">Modifier keys:</p>
        <ul className="list-disc list-inside text-xs space-y-0.5 text-surface-500">
          <li><code className="text-surface-400">CommandOrControl</code> — Cmd (macOS) / Ctrl (Win/Linux)</li>
          <li><code className="text-surface-400">Alt</code> — Option (macOS) / Alt (Win/Linux)</li>
          <li><code className="text-surface-400">Shift</code> — Shift on all platforms</li>
          <li><code className="text-surface-400">Super</code> — Win key / Cmd key</li>
        </ul>
      </div>
    </div>
  );
}

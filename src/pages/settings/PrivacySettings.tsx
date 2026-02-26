import { useConfigStore } from '../../stores/configStore';
import { Toggle, Select, Button } from '../../components/ui';

export function PrivacySettings() {
  const { config, set, clearHistory } = useConfigStore();

  const handleClearAll = () => {
    if (confirm('Clear all local data? This cannot be undone.')) {
      clearHistory();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 flex-shrink-0 mt-0.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <div>
            <p className="text-sm text-emerald-300 font-medium">Privacy-first design</p>
            <p className="text-sm text-surface-400 mt-1 leading-relaxed">
              OpenType stores all dictation history locally on your device.
              Audio is processed via API calls but is never stored by the service providers.
              We do not use your data to train any models.
            </p>
          </div>
        </div>
      </div>

      <Toggle
        checked={config.historyEnabled}
        onChange={(v) => set('historyEnabled', v)}
        label="Save dictation history"
        description="When enabled, all transcriptions are saved locally for review"
      />

      {config.historyEnabled && (
        <Select
          label="History Retention"
          value={config.historyRetention}
          onChange={(e) => set('historyRetention', e.target.value as any)}
          options={[
            { value: 'forever', label: 'Keep forever' },
            { value: '30d', label: '30 days' },
            { value: '7d', label: '7 days' },
            { value: '24h', label: '24 hours' },
            { value: '1h', label: '1 hour' },
          ]}
          hint="Older entries are automatically removed based on this setting"
        />
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-surface-200">Data Management</h3>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handleClearAll}>
            Clear All Local Data
          </Button>
        </div>
        <p className="text-xs text-surface-600">
          Deletes all history, personal dictionary entries, and learned preferences from this device.
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { GeneralSettings } from './GeneralSettings';
import { HotkeySettings } from './HotkeySettings';
import { AudioSettings } from './AudioSettings';
import { PersonalizationSettings } from './PersonalizationSettings';
import { ToneRulesSettings } from './ToneRulesSettings';
import { LanguageSettings } from './LanguageSettings';
import { PrivacySettings } from './PrivacySettings';
import { AdvancedSettings } from './AdvancedSettings';
import { ProviderSettings } from './ProviderSettings';

type SettingsTab = 'providers' | 'general' | 'hotkey' | 'audio' | 'personalization' | 'tones' | 'language' | 'privacy' | 'advanced';

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'providers', label: 'API Providers' },
  { id: 'general', label: 'General' },
  { id: 'hotkey', label: 'Hotkeys' },
  { id: 'audio', label: 'Audio' },
  { id: 'personalization', label: 'Personalization' },
  { id: 'tones', label: 'Tone Rules' },
  { id: 'language', label: 'Language' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'advanced', label: 'Advanced' },
];

export function SettingsLayout() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');

  const renderTab = () => {
    switch (activeTab) {
      case 'providers': return <ProviderSettings />;
      case 'general': return <GeneralSettings />;
      case 'hotkey': return <HotkeySettings />;
      case 'audio': return <AudioSettings />;
      case 'personalization': return <PersonalizationSettings />;
      case 'tones': return <ToneRulesSettings />;
      case 'language': return <LanguageSettings />;
      case 'privacy': return <PrivacySettings />;
      case 'advanced': return <AdvancedSettings />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader title="Settings" subtitle="Configure API providers, models, and preferences" />

      <div className="flex-1 flex overflow-hidden">
        {/* Settings nav */}
        <div className="w-44 border-r border-surface-800/40 py-3 overflow-y-auto flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors
                ${activeTab === tab.id
                  ? 'text-brand-400 bg-brand-600/10 border-r-2 border-brand-500'
                  : 'text-surface-500 hover:text-surface-300 hover:bg-surface-850'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-6">
            {renderTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

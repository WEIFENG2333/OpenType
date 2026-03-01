import { useState, useEffect } from 'react';
import { GeneralSettings } from './GeneralSettings';
import { HotkeySettings } from './HotkeySettings';
import { ToneRulesSettings } from './ToneRulesSettings';
import { PrivacySettings } from './PrivacySettings';
import { AdvancedSettings } from './AdvancedSettings';
import { ProviderSettings } from './ProviderSettings';
import { ContextSettings } from './ContextSettings';
import { useTranslation } from '../../i18n';

type SettingsTab = 'providers' | 'general' | 'context' | 'hotkey' | 'tones' | 'privacy' | 'advanced';

const tabs: Array<{ id: SettingsTab; i18nKey: string; descKey: string }> = [
  { id: 'providers', i18nKey: 'settings.tabs.providers', descKey: 'settings.providers.description' },
  { id: 'general',   i18nKey: 'settings.tabs.general',   descKey: 'settings.general.description' },
  { id: 'hotkey',    i18nKey: 'settings.tabs.hotkey',    descKey: 'settings.hotkey.description' },
  { id: 'tones',     i18nKey: 'settings.tabs.tones',     descKey: 'settings.tones.description' },
  { id: 'context',   i18nKey: 'settings.tabs.context',   descKey: 'context.description' },
  { id: 'advanced',  i18nKey: 'settings.tabs.advanced',  descKey: 'settings.advanced.description' },
  { id: 'privacy',   i18nKey: 'settings.tabs.privacy',   descKey: 'settings.privacy.privacyDesc' },
];

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');
  const { t } = useTranslation();

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'providers': return <ProviderSettings />;
      case 'general': return <GeneralSettings />;
      case 'context': return <ContextSettings />;
      case 'hotkey': return <HotkeySettings />;
      case 'tones': return <ToneRulesSettings />;
      case 'privacy': return <PrivacySettings />;
      case 'advanced': return <AdvancedSettings />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-surface-900 rounded-2xl w-[820px] max-w-[90vw] h-[600px] max-h-[85vh] flex overflow-hidden shadow-2xl border border-surface-200 dark:border-surface-700 relative">
        {/* Left nav */}
        <div className="w-48 border-r border-surface-200 dark:border-surface-800/40 py-4 overflow-y-auto flex-shrink-0 bg-surface-50/80 dark:bg-surface-900/50">
          <div className="px-5 pb-3 mb-1">
            <h2 className="text-sm font-bold text-surface-900 dark:text-surface-100">{t('settings.title')}</h2>
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-5 py-2 text-[13px] transition-all
                ${activeTab === tab.id
                  ? 'text-surface-900 dark:text-surface-100 bg-surface-200/60 dark:bg-surface-800 font-medium'
                  : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-850'
                }`}
            >
              {t(tab.i18nKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 py-8">
          <div className="max-w-xl">
            {/* Title + description as unified header */}
            <div className="mb-7">
              <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100 mb-1.5">
                {t(tabs.find(tab => tab.id === activeTab)?.i18nKey ?? '')}
              </h2>
              <p className="text-sm text-surface-500">
                {t(tabs.find(tab => tab.id === activeTab)?.descKey ?? '')}
              </p>
            </div>
            <div className="space-y-6">
              {renderTab()}
            </div>
          </div>
        </div>

        {/* Close button — anchored outside the content padding */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

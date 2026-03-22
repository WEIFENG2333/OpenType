import { useState, useEffect } from 'react';
import { useConfigStore } from './stores/configStore';
import { useTranslation, detectLocale, Locale } from './i18n';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, PageID } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { DictationPage } from './pages/DictationPage';
import { HistoryPage } from './pages/HistoryPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { SettingsModal } from './pages/settings/SettingsLayout';
import { OverlayPage } from './pages/OverlayPage';
import { UpdateNotification } from './components/UpdateNotification';

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

export default function App() {
  const [page, setPage] = useState<PageID>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = useConfigStore((s) => s.config.theme);
  const uiLanguage = useConfigStore((s) => s.config.uiLanguage);
  const loaded = useConfigStore((s) => s.loaded);
  const load = useConfigStore((s) => s.load);
  const { setLocale } = useTranslation();

  useEffect(() => { load(); }, []);

  // Listen for navigation events from main process (e.g. Dock menu)
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onNavigate((p) => {
      if (p === 'settings') {
        setSettingsOpen(true);
      } else {
        setPage(p as PageID);
      }
    });
  }, []);

  // Sync UI language from config to i18n context
  useEffect(() => {
    if (!loaded) return;
    const lang = uiLanguage === 'auto' ? detectLocale() : uiLanguage as Locale;
    setLocale(lang);
  }, [loaded, uiLanguage, setLocale]);

  // Apply theme on config change
  useEffect(() => {
    if (!loaded) return;
    applyTheme(theme);
  }, [loaded, theme]);

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (!loaded || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [loaded, theme]);

  // Check if this is the overlay window
  if (window.location.hash === '#/overlay') {
    return <OverlayPage />;
  }

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-surface-950">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage onNavigate={(p) => setPage(p as PageID)} />;
      case 'dictation': return <DictationPage />;
      case 'history': return <HistoryPage />;
      case 'dictionary': return <DictionaryPage />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-surface-950">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          current={page}
          onNavigate={setPage}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
          {renderPage()}
        </main>
      </div>

      {/* Settings Modal */}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      <UpdateNotification />
    </div>
  );
}

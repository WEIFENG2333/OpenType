import { useState, useEffect } from 'react';
import { useConfigStore } from './stores/configStore';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar, PageID } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { DictionaryPage } from './pages/DictionaryPage';
import { SettingsLayout } from './pages/settings/SettingsLayout';
import { FeedbackPage } from './pages/FeedbackPage';
import { OverlayPage } from './pages/OverlayPage';

export default function App() {
  const [page, setPage] = useState<PageID>('dashboard');
  const { config, loaded, load } = useConfigStore();

  useEffect(() => { load(); }, []);

  // Check if this is the overlay window
  if (window.location.hash === '#/overlay') {
    return <OverlayPage />;
  }

  if (!loaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface-950">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />;
      case 'history': return <HistoryPage />;
      case 'dictionary': return <DictionaryPage />;
      case 'settings': return <SettingsLayout />;
      case 'feedback': return <FeedbackPage />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-surface-950">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          current={page}
          onNavigate={setPage}
          weeklyWords={config.totalWordsThisWeek}
        />
        <main className="flex-1 flex flex-col overflow-hidden bg-surface-900">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

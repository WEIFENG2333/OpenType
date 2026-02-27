import { useState, useEffect } from 'react';
import { useTranslation } from '../i18n';

type UpdateStatus = 'idle' | 'available' | 'downloading' | 'downloaded' | 'error';

export function UpdateNotification() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const unsubs = [
      api.onUpdateAvailable((info) => {
        setVersion(info.version);
        setStatus('available');
        setDismissed(false);
      }),
      api.onDownloadProgress((p) => {
        setPercent(p.percent);
        setStatus('downloading');
      }),
      api.onUpdateDownloaded(() => setStatus('downloaded')),
      api.onUpdateError(() => setStatus('error')),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, []);

  if (dismissed || status === 'idle' || status === 'error') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-brand-500/30 bg-white dark:bg-surface-900 shadow-lg shadow-black/10 p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          {status === 'available' && (
            <>
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                {t('update.available', { version })}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                {t('update.availableDesc')}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { window.electronAPI?.downloadUpdate(); setStatus('downloading'); }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                >
                  {t('update.download')}
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                >
                  {t('update.later')}
                </button>
              </div>
            </>
          )}

          {status === 'downloading' && (
            <>
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                {t('update.downloading')}
              </p>
              <div className="mt-2 w-full h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-surface-500 mt-1">{percent}%</p>
            </>
          )}

          {status === 'downloaded' && (
            <>
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100">
                {t('update.ready')}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                {t('update.readyDesc')}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => window.electronAPI?.installUpdate()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors"
                >
                  {t('update.restart')}
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                >
                  {t('update.later')}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '../components/ui';
import { useTranslation } from '../i18n';

export function FeedbackPage() {
  const [type, setType] = useState<'accuracy' | 'feature' | 'bug'>('accuracy');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = () => {
    // In a real app this would send to a backend
    console.log('[Feedback]', { type, message });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setMessage(''); }, 3000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-surface-200 dark:border-surface-800/40 flex-shrink-0">
        <h1 className="text-lg font-semibold text-surface-900 dark:text-surface-100">{t('feedback.title')}</h1>
        <p className="text-sm text-surface-500 mt-0.5">{t('feedback.subtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* Feedback type */}
        <div>
          <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">{t('feedback.feedbackType')}</label>
          <div className="flex gap-2">
            {([
              { id: 'accuracy' as const, label: t('feedback.accuracyIssue'), icon: '🎯' },
              { id: 'feature' as const, label: t('feedback.featureRequest'), icon: '💡' },
              { id: 'bug' as const, label: t('feedback.bugReport'), icon: '🐛' },
            ]).map((ft) => (
              <button
                key={ft.id}
                onClick={() => setType(ft.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors
                  ${type === ft.id
                    ? 'border-brand-500/40 bg-brand-600/10 text-brand-400'
                    : 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-850 text-surface-600 dark:text-surface-400 hover:border-surface-400 dark:hover:border-surface-700'}`}
              >
                <span>{ft.icon}</span>
                {ft.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-1.5">{t('feedback.description')}</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === 'accuracy' ? t('feedback.accuracyPlaceholder') :
              type === 'feature' ? t('feedback.featurePlaceholder') :
              t('feedback.bugPlaceholder')
            }
            rows={6}
            className="w-full bg-white dark:bg-surface-850 border border-surface-300 dark:border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-800 dark:text-surface-200 placeholder-surface-400 dark:placeholder-surface-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSubmit} disabled={!message.trim() || submitted}>
            {submitted ? t('feedback.submitted') : t('feedback.submit')}
          </Button>
          {submitted && <span className="text-sm text-emerald-400">{t('feedback.thankYou')}</span>}
        </div>

        {/* Help section */}
        <hr className="border-surface-200 dark:border-surface-800/40" />

        <div>
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-3">{t('feedback.quickHelp')}</h2>
          <div className="space-y-3">
            <HelpItem
              q={t('feedback.helpQ1')}
              a={t('feedback.helpA1')}
            />
            <HelpItem
              q={t('feedback.helpQ2')}
              a={t('feedback.helpA2')}
            />
            <HelpItem
              q={t('feedback.helpQ3')}
              a={t('feedback.helpA3')}
            />
            <HelpItem
              q={t('feedback.helpQ4')}
              a={t('feedback.helpA4')}
            />
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-surface-500 dark:text-surface-700 py-4">
          OpenType v1.0.0
        </div>
      </div>
    </div>
  );
}

function HelpItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-surface-850 border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm text-surface-700 dark:text-surface-300 font-medium">{q}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-surface-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-surface-600 dark:text-surface-400 leading-relaxed animate-fade-in">{a}</div>
      )}
    </div>
  );
}

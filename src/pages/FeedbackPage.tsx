import { useState } from 'react';
import { Button } from '../components/ui';

export function FeedbackPage() {
  const [type, setType] = useState<'accuracy' | 'feature' | 'bug'>('accuracy');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // In a real app this would send to a backend
    console.log('[Feedback]', { type, message });
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setMessage(''); }, 3000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-surface-800/40 flex-shrink-0">
        <h1 className="text-lg font-semibold text-surface-100">Feedback & Help</h1>
        <p className="text-sm text-surface-500 mt-0.5">Report issues, suggest features, or get help</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* Feedback type */}
        <div>
          <label className="block text-sm font-medium text-surface-400 mb-2">Feedback Type</label>
          <div className="flex gap-2">
            {([
              { id: 'accuracy' as const, label: 'Accuracy Issue', icon: '🎯' },
              { id: 'feature' as const, label: 'Feature Request', icon: '💡' },
              { id: 'bug' as const, label: 'Bug Report', icon: '🐛' },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-colors
                  ${type === t.id
                    ? 'border-brand-500/40 bg-brand-600/10 text-brand-400'
                    : 'border-surface-800 bg-surface-850 text-surface-400 hover:border-surface-700'}`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-surface-400 mb-1.5">Description</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              type === 'accuracy' ? 'Describe what was transcribed incorrectly and what you expected...' :
              type === 'feature' ? 'Describe the feature you would like to see...' :
              'Describe the bug and steps to reproduce...'
            }
            rows={6}
            className="w-full bg-surface-850 border border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 resize-none"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={handleSubmit} disabled={!message.trim() || submitted}>
            {submitted ? 'Submitted!' : 'Submit Feedback'}
          </Button>
          {submitted && <span className="text-sm text-emerald-400">Thank you for your feedback!</span>}
        </div>

        {/* Help section */}
        <hr className="border-surface-800/40" />

        <div>
          <h2 className="text-sm font-semibold text-surface-200 mb-3">Quick Help</h2>
          <div className="space-y-3">
            <HelpItem
              q="How do I start dictating?"
              a="Click the microphone button on the Dashboard, or press Ctrl+Shift+Space anywhere on your system."
            />
            <HelpItem
              q="How do I configure API keys?"
              a="Go to Settings → API Providers and enter your SiliconFlow, OpenRouter, or OpenAI API key."
            />
            <HelpItem
              q="Why is my transcription inaccurate?"
              a="Try adding specialized terms to your Personal Dictionary. Also ensure you're using a good microphone and speaking clearly."
            />
            <HelpItem
              q="Can I use OpenType offline?"
              a="Currently, OpenType requires an internet connection for STT and LLM APIs. Local model support is planned."
            />
          </div>
        </div>

        {/* Version */}
        <div className="text-center text-xs text-surface-700 py-4">
          OpenType v1.0.0
        </div>
      </div>
    </div>
  );
}

function HelpItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-surface-850 border border-surface-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm text-surface-300 font-medium">{q}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-surface-500 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-3 text-sm text-surface-400 leading-relaxed animate-fade-in">{a}</div>
      )}
    </div>
  );
}

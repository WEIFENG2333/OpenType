import { useState } from 'react';
import { useConfigStore } from '../stores/configStore';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui';

export function DictionaryPage() {
  const dict = useConfigStore((s) => s.config.personalDictionary);
  const addWord = useConfigStore((s) => s.addDictionaryWord);
  const removeWord = useConfigStore((s) => s.removeDictionaryWord);
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (!input.trim()) return;
    // Support comma-separated batch add
    input.split(',').forEach((w) => {
      const trimmed = w.trim();
      if (trimmed) addWord(trimmed);
    });
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <PageHeader
        title="Personal Dictionary"
        subtitle="Add specialized terms, brand names, or abbreviations to improve accuracy"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Add form */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Add terms (comma-separated, e.g. Kubernetes, gRPC, OpenType)"
            className="flex-1 bg-surface-850 border border-surface-700 rounded-lg px-4 py-2.5 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
          <Button variant="primary" onClick={handleAdd} disabled={!input.trim()}>Add</Button>
        </div>

        {/* Word tags */}
        {dict.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-surface-600">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 opacity-40">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
            </svg>
            <p className="text-base">No custom terms yet</p>
            <p className="text-sm mt-1 text-surface-700">Words here help the AI spell domain-specific vocabulary correctly</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dict.map((word) => (
              <div
                key={word}
                className="flex items-center gap-2 bg-surface-850 border border-surface-800 rounded-lg px-3 py-1.5 group hover:border-red-500/30 transition-colors"
              >
                <span className="text-sm text-surface-300">{word}</span>
                <button
                  onClick={() => removeWord(word)}
                  className="text-surface-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="bg-brand-500/5 border border-brand-500/10 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brand-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            <div>
              <p className="text-sm text-brand-300 font-medium">How it works</p>
              <p className="text-sm text-surface-400 mt-1 leading-relaxed">
                Dictionary terms are injected into the LLM context during post-processing. This helps correctly
                spell brand names, technical jargon, abbreviations, and domain-specific vocabulary that standard
                speech recognition might miss.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

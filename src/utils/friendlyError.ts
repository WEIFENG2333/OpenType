/** Map technical error strings to user-friendly localized messages */
export function friendlyErrorMessage(error: string, t: (k: string) => string): { title: string; detail: string } {
  const lower = error.toLowerCase();
  if (lower.includes('no api key') || lower.includes('api key required'))
    return { title: t('recording.errorApiKey'), detail: t('recording.errorApiKeyDetail') };
  if (lower.includes('no stt model') || lower.includes('no llm model'))
    return { title: t('recording.errorNoModel'), detail: t('recording.errorNoModelDetail') };
  if (lower.includes('microphone') || lower.includes('mic'))
    return { title: t('recording.errorMic'), detail: error };
  if (lower.includes('no speech'))
    return { title: t('recording.errorNoSpeech'), detail: t('recording.errorNoSpeechDetail') };
  if (lower.includes('timeout') || lower.includes('timed out'))
    return { title: t('recording.errorTimeout'), detail: t('recording.errorTimeoutDetail') };
  if (lower.includes('pipeline busy'))
    return { title: t('recording.errorBusy'), detail: t('recording.errorBusyDetail') };
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('invalid'))
    return { title: t('recording.errorAuth'), detail: t('recording.errorAuthDetail') };
  if (lower.includes('429') || lower.includes('rate limit'))
    return { title: t('recording.errorRateLimit'), detail: t('recording.errorRateLimitDetail') };
  if (/\b5\d\d\b/.test(error) || lower.includes('service unavailable') || lower.includes('bad gateway'))
    return { title: t('recording.errorServer'), detail: t('recording.errorServerDetail') };
  return { title: t('recording.error'), detail: error };
}

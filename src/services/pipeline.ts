/**
 * Full dictation pipeline: Audio → STT → LLM → Polished text.
 * This orchestrates the two-stage process.
 */

import { AppConfig } from '../types/config';
import { transcribeAudio } from './sttService';
import { processText } from './llmService';

export interface PipelineResult {
  success: boolean;
  rawText: string;
  processedText: string;
  skipped?: boolean;
  error?: string;
}

export async function runPipeline(
  audioBuffer: ArrayBuffer,
  config: AppConfig,
  context?: { appName?: string },
): Promise<PipelineResult> {
  // If Electron is available, delegate the whole pipeline to main process
  if (window.electronAPI) {
    const r = await window.electronAPI.processPipeline(audioBuffer, context);
    return {
      success: r.success,
      rawText: r.rawText ?? '',
      processedText: r.processedText ?? '',
      skipped: r.skipped,
      error: r.error,
    };
  }

  // Browser-mode pipeline
  console.log('[Pipeline] Stage 1: STT...');
  const stt = await transcribeAudio(audioBuffer, config, {
    language: config.inputLanguage,
  });

  if (!stt.success) {
    return { success: false, rawText: '', processedText: '', error: stt.error };
  }

  const rawText = stt.text ?? '';
  if (!rawText.trim()) {
    return { success: true, rawText: '', processedText: '', skipped: true };
  }

  console.log('[Pipeline] Stage 1 result:', rawText);
  console.log('[Pipeline] Stage 2: LLM post-processing...');

  const llm = await processText(rawText, config, context);
  if (!llm.success) {
    return { success: false, rawText, processedText: '', error: llm.error };
  }

  const processedText = llm.text ?? rawText;
  console.log('[Pipeline] Stage 2 result:', processedText);

  return { success: true, rawText, processedText };
}

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
  // Pipeline metadata for history
  systemPrompt?: string;
  sttProvider?: string;
  llmProvider?: string;
  sttModel?: string;
  llmModel?: string;
  sttDurationMs?: number;
  llmDurationMs?: number;
  autoLearnedTerms?: string[];
}

export async function runPipeline(
  audioBuffer: ArrayBuffer,
  config: AppConfig,
  context?: Record<string, any>,
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
      systemPrompt: r.systemPrompt,
      sttProvider: r.sttProvider,
      llmProvider: r.llmProvider,
      sttModel: r.sttModel,
      llmModel: r.llmModel,
      sttDurationMs: r.sttDurationMs,
      llmDurationMs: r.llmDurationMs,
      autoLearnedTerms: r.autoLearnedTerms,
    };
  }

  // Browser-mode pipeline (no timing / auto-learn in browser)
  console.log('[Pipeline] Stage 1: STT...');
  const sttStart = Date.now();
  const stt = await transcribeAudio(audioBuffer, config, {
    language: config.inputLanguage,
  });
  const sttDurationMs = Date.now() - sttStart;

  if (!stt.success) {
    return { success: false, rawText: '', processedText: '', error: stt.error, sttDurationMs };
  }

  const rawText = stt.text ?? '';
  if (!rawText.trim()) {
    return { success: true, rawText: '', processedText: '', skipped: true, sttDurationMs };
  }

  console.log('[Pipeline] Stage 2: LLM post-processing...');
  const llmStart = Date.now();
  const llm = await processText(rawText, config, context);
  const llmDurationMs = Date.now() - llmStart;

  if (!llm.success) {
    return { success: false, rawText, processedText: '', error: llm.error, sttDurationMs, llmDurationMs };
  }

  const processedText = llm.text ?? rawText;
  return { success: true, rawText, processedText, sttDurationMs, llmDurationMs };
}

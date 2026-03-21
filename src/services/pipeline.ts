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
): Promise<PipelineResult> {
  // If Electron is available, delegate the whole pipeline to main process
  if (window.electronAPI) {
    return window.electronAPI.processPipeline(audioBuffer);
  }

  // Browser-mode pipeline (no timing / auto-learn in browser)
  console.log('[Pipeline] Stage 1: STT...');
  const sttStart = Date.now();
  const stt = await transcribeAudio(audioBuffer, config);
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
  const llm = await processText(rawText, config);
  const llmDurationMs = Date.now() - llmStart;

  if (!llm.success) {
    return { success: false, rawText, processedText: '', error: llm.error, sttDurationMs, llmDurationMs };
  }

  const processedText = llm.text ?? rawText;
  return { success: true, rawText, processedText, sttDurationMs, llmDurationMs };
}

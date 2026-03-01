import { clipboard, systemPreferences, desktopCapturer } from 'electron';
import { exec } from 'child_process';
import { state, isMac } from './app-state';

function execAsync(cmd: string, opts: { input?: string; timeout?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = exec(cmd, { timeout: opts.timeout ?? 2000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString().trim());
    });
    if (opts.input && proc.stdin) {
      proc.stdin.write(opts.input);
      proc.stdin.end();
    }
  });
}

export interface CapturedContext {
  appName?: string;
  windowTitle?: string;
  bundleId?: string;
  url?: string;
  selectedText?: string;
  fieldText?: string;
  fieldRole?: string;
  fieldRoleDescription?: string;
  fieldLabel?: string;
  fieldPlaceholder?: string;
  cursorPosition?: number;
  selectionRange?: { location: number; length: number };
  numberOfCharacters?: number;
  insertionLineNumber?: number;
  clipboardText?: string;
  recentTranscriptions?: string[];
  screenContext?: string;
  screenshotDataUrl?: string;
  ocrDurationMs?: number;
}

async function captureContextMac(enableL1: boolean): Promise<CapturedContext> {
  const ctx: CapturedContext = {};
  const SEP = '‖‖‖';

  try {
    const script = `
set d to "${SEP}"
set output to ""
tell application "System Events"
  set fp to first process whose frontmost is true
  set appName to name of fp
  set output to appName

  set bid to ""
  try
    set bid to bundle identifier of fp
  end try
  set output to output & d & bid

  set winTitle to ""
  try
    set winTitle to name of first window of fp
  end try
  set output to output & d & winTitle

  set elRole to ""
  set selText to ""
  set elRoleDesc to ""
  set elLabel to ""
  set elPlaceholder to ""
  set selRange to ""
  set charCount to ""
  set lineNum to ""
  set fieldVal to ""
  ${enableL1 ? `
  try
    set focusEl to value of attribute "AXFocusedUIElement" of fp
    try
      set elRole to value of attribute "AXRole" of focusEl
    end try
    try
      set selText to value of attribute "AXSelectedText" of focusEl
    end try
    try
      set elRoleDesc to value of attribute "AXRoleDescription" of focusEl
    end try
    try
      set elLabel to value of attribute "AXDescription" of focusEl
    end try
    if elLabel is "" then
      try
        set elLabel to value of attribute "AXTitle" of focusEl
      end try
    end if
    try
      set elPlaceholder to value of attribute "AXPlaceholderValue" of focusEl
    end try
    try
      set rng to value of attribute "AXSelectedTextRange" of focusEl
      set selRange to ((item 1 of rng) as text) & "," & ((item 2 of rng) as text)
    end try
    try
      set charCount to (value of attribute "AXNumberOfCharacters" of focusEl) as text
    end try
    try
      set lineNum to (value of attribute "AXInsertionPointLineNumber" of focusEl) as text
    end try
    try
      set fieldVal to value of attribute "AXValue" of focusEl
      if (count of fieldVal) > 3000 then
        set fieldVal to text 1 thru 3000 of fieldVal
      end if
    end try
  end try` : ''}

  set output to output & d & elRole & d & selText & d & elRoleDesc & d & elLabel & d & elPlaceholder & d & selRange & d & charCount & d & lineNum & d & fieldVal
end tell
return output`;

    const raw = await execAsync('osascript -', { input: script, timeout: 3500 });
    const parts = raw.split(SEP);

    ctx.appName = parts[0] || undefined;
    ctx.bundleId = parts[1] || undefined;
    ctx.windowTitle = parts[2] || undefined;
    ctx.fieldRole = parts[3] || undefined;
    ctx.selectedText = parts[4] || undefined;
    ctx.fieldRoleDescription = parts[5] || undefined;
    ctx.fieldLabel = parts[6] || undefined;
    ctx.fieldPlaceholder = parts[7] || undefined;

    if (parts[8]) {
      const rangeMatch = parts[8].match(/(\d+)\D+(\d+)/);
      if (rangeMatch) {
        const location = parseInt(rangeMatch[1], 10);
        const length = parseInt(rangeMatch[2], 10);
        ctx.selectionRange = { location, length };
        if (length === 0) {
          ctx.cursorPosition = location;
        }
      }
    }

    if (parts[9]) {
      const n = parseInt(parts[9], 10);
      if (!isNaN(n)) ctx.numberOfCharacters = n;
    }

    if (parts[10]) {
      const n = parseInt(parts[10], 10);
      if (!isNaN(n)) ctx.insertionLineNumber = n;
    }

    ctx.fieldText = parts.slice(11).join(SEP) || undefined;

    if (ctx.fieldText && ctx.fieldText.length > 3000) {
      ctx.fieldText = ctx.fieldText.slice(0, 3000);
    }
  } catch (e) {
    console.error('[Context] macOS capture error:', e);
  }

  if (ctx.appName) {
    ctx.url = await captureBrowserUrl(ctx.appName) || undefined;
  }

  return ctx;
}

async function captureBrowserUrl(appName: string): Promise<string | null> {
  if (!isMac) return null;

  const browserScripts: Record<string, string> = {
    'Safari': 'tell application "Safari" to get URL of current tab of first window',
    'Google Chrome': 'tell application "Google Chrome" to get URL of active tab of first window',
    'Microsoft Edge': 'tell application "Microsoft Edge" to get URL of active tab of first window',
    'Arc': 'tell application "Arc" to get URL of active tab of first window',
    'Brave Browser': 'tell application "Brave Browser" to get URL of active tab of first window',
    'Chromium': 'tell application "Chromium" to get URL of active tab of first window',
    'Opera': 'tell application "Opera" to get URL of active tab of first window',
    'Vivaldi': 'tell application "Vivaldi" to get URL of active tab of first window',
  };

  const script = browserScripts[appName];
  if (!script) return null;

  try {
    return await execAsync(`osascript -e '${script}'`, { timeout: 1000 }) || null;
  } catch {
    return null;
  }
}

async function captureContextWin(): Promise<CapturedContext> {
  const ctx: CapturedContext = {};
  try {
    const ps = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName UIAutomationClient
Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();' -Name W -Namespace N -PassThru | Out-Null
$hwnd = [N.W]::GetForegroundWindow()
$proc = Get-Process | Where-Object {$_.MainWindowHandle -eq $hwnd} | Select-Object -First 1
$title = $proc.MainWindowTitle
$name = $proc.ProcessName
$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
$role = ""
$val = ""
$sel = ""
$label = ""
$placeholder = ""
$selStart = ""
$selLen = ""
try { $role = $focused.Current.ControlType.ProgrammaticName } catch {}
try { $label = $focused.Current.Name } catch {}
try { $placeholder = $focused.Current.HelpText } catch {}
try {
  $vp = $focused.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  $val = $vp.Current.Value
  if ($val.Length -gt 3000) { $val = $val.Substring(0, 3000) }
} catch {}
try {
  $tp = $focused.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
  $ranges = $tp.GetSelection()
  if ($ranges.Length -gt 0) {
    $sel = $ranges[0].GetText(-1)
    $docRange = $tp.DocumentRange
    $before = $docRange.Clone()
    $before.MoveEndpointByRange([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End, $ranges[0], [System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start)
    $selStart = $before.GetText(-1).Length
    $selLen = $sel.Length
  }
} catch {}
Write-Output "$name|||$title|||$role|||$sel|||$label|||$placeholder|||$selStart|||$selLen|||$val"`;
    const raw = await execAsync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`, { timeout: 3000 });
    const parts = raw.split('|||');
    ctx.appName = parts[0] || undefined;
    ctx.windowTitle = parts[1] || undefined;
    ctx.fieldRole = parts[2] || undefined;
    ctx.selectedText = parts[3] || undefined;
    ctx.fieldLabel = parts[4] || undefined;
    ctx.fieldPlaceholder = parts[5] || undefined;
    if (parts[6] && parts[7]) {
      const loc = parseInt(parts[6], 10);
      const len = parseInt(parts[7], 10);
      if (!isNaN(loc) && !isNaN(len)) {
        ctx.selectionRange = { location: loc, length: len };
        if (len === 0) ctx.cursorPosition = loc;
      }
    }
    ctx.fieldText = parts.slice(8).join('|||') || undefined;
  } catch (e) {
    console.error('[Context] Windows capture error:', e);
    try {
      const ps = `(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();' -Name W -Namespace N -PassThru)::GetForegroundWindow()}).MainWindowTitle`;
      const title = await execAsync(`powershell -Command "${ps}"`, { timeout: 2000 });
      ctx.appName = title.split(' - ').pop() || title;
      ctx.windowTitle = title;
    } catch {}
  }
  return ctx;
}

async function captureContextLinux(): Promise<CapturedContext> {
  const ctx: CapturedContext = {};
  try {
    const title = await execAsync('xdotool getactivewindow getwindowname 2>/dev/null', { timeout: 1000 });
    ctx.appName = title;
    ctx.windowTitle = title;
    try {
      const sel = await execAsync('xclip -selection primary -o 2>/dev/null', { timeout: 500 });
      if (sel && sel.length < 5000) ctx.selectedText = sel;
    } catch {}
  } catch (e) {
    console.error('[Context] Linux capture error:', e);
  }
  return ctx;
}

export async function captureFullContext(config: Record<string, any>): Promise<CapturedContext> {
  const l0Enabled = config.contextL0Enabled !== false;
  const l1Enabled = !!config.contextL1Enabled;

  let ctx: CapturedContext = {};

  if (l0Enabled) {
    if (isMac) {
      const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);
      const hasAccessibility = l1Enabled && accessibilityGranted;
      if (l1Enabled && !accessibilityGranted) console.warn('[Context] L1 enabled but accessibility permission not granted');
      ctx = await captureContextMac(hasAccessibility);
    } else if (process.platform === 'win32') {
      ctx = await captureContextWin();
    } else {
      ctx = await captureContextLinux();
    }
  }

  try {
    const clip = clipboard.readText();
    if (clip && clip.trim().length > 0 && clip.trim().length < 5000) {
      ctx.clipboardText = clip.trim();
    }
  } catch {}

  try {
    const history: any[] = config.history || [];
    const recent = history
      .filter((h: any) => h.processedText && !h.error)
      .slice(0, 3)
      .map((h: any) => h.processedText);
    if (recent.length > 0) {
      ctx.recentTranscriptions = recent;
    }
  } catch {}

  return ctx;
}

export async function captureScreenAndOcr(config: Record<string, any>): Promise<{ text: string; screenshot?: string; durationMs: number } | null> {
  if (!config.contextOcrModel) throw new Error('contextOcrModel not configured');
  const model = config.contextOcrModel;
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    if (!sources.length) { console.warn('[OCR] no screen sources'); return null; }

    const thumbnail = sources[0].thumbnail;
    const size = thumbnail.getSize();
    const jpegBuffer = thumbnail.toJPEG(80);
    console.log(`[OCR] screenshot ${size.width}x${size.height}, jpeg=${jpegBuffer.length} bytes, empty=${thumbnail.isEmpty()}`);
    if (thumbnail.isEmpty()) {
      throw new Error('Screen capture returned empty image — screen recording permission not granted');
    }
    const base64 = jpegBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const t0 = Date.now();
    const ocrResult = await state.llmService!.analyzeScreenshot(dataUrl, config);
    const durationMs = Date.now() - t0;
    console.log(`[OCR] ${model} → ${durationMs}ms, ${ocrResult.length} chars`);
    return { text: ocrResult, screenshot: dataUrl, durationMs };
  } catch (e: any) {
    console.error('[OCR] error:', e.message);
    return null;
  }
}

export function extractDictionaryTerms(text: string, existingDict: string[]): string[] {
  const terms = new Set<string>();
  const existing = new Set(existingDict.map((w) => w.toLowerCase()));

  const words = text.split(/[\s,;:!?。，；：！？]+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/^["""''（）()[\]]+|["""''（）()[\].]+$/g, '');
    if (!word || word.length < 2) continue;

    const prevWord = i > 0 ? words[i - 1] : '';
    const isSentenceStart = i === 0 || /[.!?。！？]$/.test(prevWord);

    if (/^[A-Z]{2,6}$/.test(word) && !existing.has(word.toLowerCase())) {
      terms.add(word); continue;
    }
    if (/^[A-Z][a-z]+[A-Z]/.test(word) || /^[a-z]+[A-Z]/.test(word)) {
      if (!existing.has(word.toLowerCase())) terms.add(word); continue;
    }
    if (!isSentenceStart && /^[A-Z][a-z]{1,}/.test(word)) {
      const lower = word.toLowerCase();
      const common = new Set(['the','and','but','for','not','you','all','can','had','her','was','one','our','out','day','get','has','him','his','how','its','may','new','now','old','see','way','who','did','let','say','she','too','use']);
      if (!common.has(lower) && !existing.has(lower)) terms.add(word);
    }
  }
  return Array.from(terms).slice(0, 5);
}

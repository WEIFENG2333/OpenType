import {
  app, BrowserWindow, globalShortcut, ipcMain,
  Tray, Menu, nativeImage, clipboard,
  session, systemPreferences, screen, desktopCapturer,
} from 'electron';
import path from 'path';
import { execSync } from 'child_process';
import { autoUpdater } from 'electron-updater';
import { ConfigStore } from './config-store';
import { STTService } from './stt-service';
import { LLMService } from './llm-service';

// ─── State ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

let configStore: ConfigStore;
let sttService: STTService;
let llmService: LLMService;

const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';

// ─── Recording State & Auto-Mute ────────────────────────────────────────────

let isRecording = false;
let wasMutedBeforeRecording = false;

function setSystemMute(mute: boolean): void {
  try {
    if (isMac) {
      if (mute) {
        const isMuted = execSync("osascript -e 'output muted of (get volume settings)'", { timeout: 1000 })
          .toString().trim();
        wasMutedBeforeRecording = isMuted === 'true';
        if (!wasMutedBeforeRecording) {
          execSync("osascript -e 'set volume with output muted'");
        }
      } else {
        if (!wasMutedBeforeRecording) {
          execSync("osascript -e 'set volume without output muted'");
        }
      }
    } else if (process.platform === 'linux') {
      if (mute) {
        try {
          const state = execSync('pactl get-sink-mute @DEFAULT_SINK@', { timeout: 1000 }).toString().trim();
          wasMutedBeforeRecording = state.includes('yes');
          if (!wasMutedBeforeRecording) execSync('pactl set-sink-mute @DEFAULT_SINK@ 1');
        } catch {}
      } else {
        if (!wasMutedBeforeRecording) {
          try { execSync('pactl set-sink-mute @DEFAULT_SINK@ 0'); } catch {}
        }
      }
    }
    // Windows: no reliable silent mute command, skip for now
  } catch (e: any) {
    console.error('[AutoMute] error:', e.message);
  }
}

// ─── Auto-Dictionary: Extract Proper Nouns ──────────────────────────────────

function extractDictionaryTerms(text: string, existingDict: string[]): string[] {
  const terms = new Set<string>();
  const existing = new Set(existingDict.map((w) => w.toLowerCase()));

  const words = text.split(/[\s,;:!?。，；：！？]+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/^["""''（）()[\]]+|["""''（）()[\].]+$/g, '');
    if (!word || word.length < 2) continue;

    const prevWord = i > 0 ? words[i - 1] : '';
    const isSentenceStart = i === 0 || /[.!?。！？]$/.test(prevWord);

    // Acronyms (ALL CAPS, 2-6 chars)
    if (/^[A-Z]{2,6}$/.test(word) && !existing.has(word.toLowerCase())) {
      terms.add(word); continue;
    }
    // CamelCase / PascalCase (TypeScript, iPhone, OpenType)
    if (/^[A-Z][a-z]+[A-Z]/.test(word) || /^[a-z]+[A-Z]/.test(word)) {
      if (!existing.has(word.toLowerCase())) terms.add(word); continue;
    }
    // Capitalized words not at sentence start (proper nouns)
    if (!isSentenceStart && /^[A-Z][a-z]{1,}/.test(word)) {
      const lower = word.toLowerCase();
      const common = new Set(['the','and','but','for','not','you','all','can','had','her','was','one','our','out','day','get','has','him','his','how','its','may','new','now','old','see','way','who','did','let','say','she','too','use']);
      if (!common.has(lower) && !existing.has(lower)) terms.add(word);
    }
  }
  return Array.from(terms).slice(0, 5);
}

// ─── Context Awareness ─────────────────────────────────────────────────────

interface CapturedContext {
  appName?: string;
  windowTitle?: string;
  bundleId?: string;
  url?: string;
  selectedText?: string;
  fieldText?: string;
  fieldRole?: string;
  clipboardText?: string;
  recentTranscriptions?: string[];
  screenContext?: string;
  screenshotDataUrl?: string;
}

let lastCapturedContext: CapturedContext = {};
let ocrPromise: Promise<{ text: string; screenshot?: string } | null> | null = null;

/** Capture all context on macOS using a single efficient AppleScript call */
function captureContextMac(enableL1: boolean): CapturedContext {
  const ctx: CapturedContext = {};
  const SEP = '‖‖‖'; // unlikely separator

  try {
    // Single AppleScript to get L0 + L1 data in one call
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
  set fieldVal to ""
  ${enableL1 ? `
  try
    set focusEl to focused UI element of fp
    try
      set elRole to value of attribute "AXRole" of focusEl
    end try
    try
      set selText to value of attribute "AXSelectedText" of focusEl
    end try
    try
      set fieldVal to value of attribute "AXValue" of focusEl
      if (count of fieldVal) > 3000 then
        set fieldVal to text 1 thru 3000 of fieldVal
      end if
    end try
  end try` : ''}

  set output to output & d & elRole & d & selText & d & fieldVal
end tell
return output`;

    const raw = execSync('osascript -', { input: script, timeout: 2000 }).toString().trim();
    const parts = raw.split(SEP);

    ctx.appName = parts[0] || undefined;
    ctx.bundleId = parts[1] || undefined;
    ctx.windowTitle = parts[2] || undefined;
    ctx.fieldRole = parts[3] || undefined;
    ctx.selectedText = parts[4] || undefined;
    // fieldText is last — may contain separators in theory, so join remainder
    ctx.fieldText = parts.slice(5).join(SEP) || undefined;

    // Truncate fieldText for storage
    if (ctx.fieldText && ctx.fieldText.length > 3000) {
      ctx.fieldText = ctx.fieldText.slice(0, 3000);
    }
  } catch (e) {
    console.error('[Context] macOS capture error:', e);
  }

  // Get browser URL if the frontmost app is a known browser
  if (ctx.appName) {
    ctx.url = captureBrowserUrl(ctx.appName) || undefined;
  }

  return ctx;
}

/** Get URL from known browsers via AppleScript */
function captureBrowserUrl(appName: string): string | null {
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
    return execSync(`osascript -e '${script}'`, { timeout: 1000 }).toString().trim() || null;
  } catch {
    return null;
  }
}

/** Capture context on Windows */
function captureContextWin(): CapturedContext {
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
try { $role = $focused.Current.ControlType.ProgrammaticName } catch {}
try {
  $vp = $focused.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  $val = $vp.Current.Value
  if ($val.Length -gt 3000) { $val = $val.Substring(0, 3000) }
} catch {}
try {
  $tp = $focused.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
  $ranges = $tp.GetSelection()
  if ($ranges.Length -gt 0) { $sel = $ranges[0].GetText(-1) }
} catch {}
Write-Output "$name|||$title|||$role|||$sel|||$val"`;
    const raw = execSync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`, { timeout: 3000 }).toString().trim();
    const parts = raw.split('|||');
    ctx.appName = parts[0] || undefined;
    ctx.windowTitle = parts[1] || undefined;
    ctx.fieldRole = parts[2] || undefined;
    ctx.selectedText = parts[3] || undefined;
    ctx.fieldText = parts[4] || undefined;
  } catch (e) {
    console.error('[Context] Windows capture error:', e);
    // Fallback: just get window title
    try {
      const ps = `(Get-Process | Where-Object {$_.MainWindowHandle -eq (Add-Type -MemberDefinition '[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();' -Name W -Namespace N -PassThru)::GetForegroundWindow()}).MainWindowTitle`;
      const title = execSync(`powershell -Command "${ps}"`, { timeout: 2000 }).toString().trim();
      ctx.appName = title.split(' - ').pop() || title;
      ctx.windowTitle = title;
    } catch {}
  }
  return ctx;
}

/** Capture context on Linux */
function captureContextLinux(): CapturedContext {
  const ctx: CapturedContext = {};
  try {
    const title = execSync('xdotool getactivewindow getwindowname 2>/dev/null', { timeout: 1000 }).toString().trim();
    ctx.appName = title;
    ctx.windowTitle = title;
    // Try to get selected text via xclip
    try {
      const sel = execSync('xclip -selection primary -o 2>/dev/null', { timeout: 500 }).toString();
      if (sel && sel.length < 5000) ctx.selectedText = sel;
    } catch {}
  } catch (e) {
    console.error('[Context] Linux capture error:', e);
  }
  return ctx;
}

/** Capture full context based on platform and config */
function captureFullContext(config: Record<string, any>): CapturedContext {
  const l0Enabled = config.contextL0Enabled !== false;
  const l1Enabled = !!config.contextL1Enabled;

  let ctx: CapturedContext = {};

  if (l0Enabled) {
    if (isMac) {
      const hasAccessibility = l1Enabled && systemPreferences.isTrustedAccessibilityClient(false);
      ctx = captureContextMac(hasAccessibility);
    } else if (process.platform === 'win32') {
      ctx = captureContextWin();
    } else {
      ctx = captureContextLinux();
    }
  }

  // Clipboard content (always capture — lightweight and useful)
  try {
    const clip = clipboard.readText();
    if (clip && clip.trim().length > 0 && clip.trim().length < 5000) {
      ctx.clipboardText = clip.trim();
    }
  } catch {}

  // Recent transcriptions for continuity context (last 3 successful ones)
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

/** Start screenshot + OCR in background (returns promise) */
async function captureScreenAndOcr(config: Record<string, any>): Promise<{ text: string; screenshot?: string } | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    if (!sources.length) return null;

    const thumbnail = sources[0].thumbnail;
    const jpegBuffer = thumbnail.toJPEG(80);
    const base64 = jpegBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    // Send to VLM for analysis
    const ocrResult = await llmService.analyzeScreenshot(dataUrl, config);
    return { text: ocrResult, screenshot: dataUrl };
  } catch (e: any) {
    console.error('[Context OCR] error:', e.message);
    return null;
  }
}

// ─── Window Creation ────────────────────────────────────────────────────────

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 820,
    minHeight: 560,
    frame: false,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    ...(isMac ? { trafficLightPosition: { x: 12, y: 12 } } : {}),
    backgroundColor: '#09090b',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createOverlayWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;
  const overlayW = 280;
  const overlayH = 56;

  overlayWindow = new BrowserWindow({
    width: overlayW,
    height: overlayH,
    x: Math.round((screenW - overlayW) / 2),
    y: screenH - overlayH - 16,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  const url = isDev ? 'http://localhost:5173/#/overlay' : undefined;
  if (url) {
    overlayWindow.loadURL(url);
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/overlay' });
  }

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
}

// ─── Microphone Permissions ─────────────────────────────────────────────────

function setupPermissions() {
  // Grant microphone / audio capture to renderer process
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'mediaKeySystem'];
    callback(allowed.includes(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });
}

// ─── System Tray ────────────────────────────────────────────────────────────

function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '../public/icon.svg')
    : path.join(__dirname, '../dist/icon.svg');

  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 });
  } catch {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('OpenType — Voice Dictation');

  const menu = Menu.buildFromTemplate([
    { label: 'Show OpenType', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Start Dictation', accelerator: 'CmdOrCtrl+Shift+Space', click: toggleRecording },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

// ─── Global Shortcut ────────────────────────────────────────────────────────

function registerShortcuts() {
  globalShortcut.unregisterAll();

  const key = configStore.get('globalHotkey') || 'CommandOrControl+Shift+Space';
  try {
    globalShortcut.register(key, toggleRecording);
    console.log('[Shortcut] registered:', key);
  } catch (e) {
    console.error('[Shortcut] register failed:', key, e);
  }
}

function toggleRecording() {
  const cfg = configStore.getAll();
  isRecording = !isRecording;

  if (isRecording) {
    // Starting recording: capture context BEFORE overlay steals focus
    lastCapturedContext = captureFullContext(cfg);
    console.log('[Context] captured:', JSON.stringify({
      app: lastCapturedContext.appName,
      window: lastCapturedContext.windowTitle,
      role: lastCapturedContext.fieldRole,
      hasSelected: !!lastCapturedContext.selectedText,
      hasField: !!lastCapturedContext.fieldText,
      url: lastCapturedContext.url,
    }));

    // Start OCR in background if enabled (runs while user speaks)
    if (cfg.contextOcrEnabled) {
      ocrPromise = captureScreenAndOcr(cfg);
    } else {
      ocrPromise = null;
    }

    // Auto-mute system audio
    if (cfg.autoMuteOnRecord) setSystemMute(true);
  } else {
    // Stopping recording: unmute
    if (cfg.autoMuteOnRecord) setSystemMute(false);
  }

  mainWindow?.webContents.send('toggle-recording');
  if (overlayWindow) {
    overlayWindow.webContents.send('toggle-recording');
    if (!overlayWindow.isVisible()) overlayWindow.show();
  }
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────

function setupIPC() {
  // Config
  ipcMain.handle('config:get', (_e, key: string) => configStore.get(key));
  ipcMain.handle('config:set', (_e, key: string, val: any) => { configStore.set(key, val); return true; });
  ipcMain.handle('config:getAll', () => configStore.getAll());

  // Microphone permission
  ipcMain.handle('mic:checkPermission', async () => {
    if (isMac) {
      return systemPreferences.getMediaAccessStatus('microphone');
    }
    return 'granted';
  });

  ipcMain.handle('mic:requestPermission', async () => {
    if (isMac) {
      return systemPreferences.askForMediaAccess('microphone');
    }
    return true;
  });

  // Shortcuts re-registration
  ipcMain.handle('shortcuts:reregister', () => {
    registerShortcuts();
    return true;
  });

  // Platform info
  ipcMain.handle('app:platform', () => process.platform);

  // STT
  ipcMain.handle('stt:transcribe', async (_e, buf: ArrayBuffer, opts: any) => {
    try {
      const text = await sttService.transcribe(Buffer.from(buf), configStore.getAll(), opts);
      console.log('[STT] result:', text.slice(0, 100));
      return { success: true, text };
    } catch (e: any) {
      console.error('[STT] error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // LLM
  ipcMain.handle('llm:process', async (_e, text: string, ctx: any) => {
    try {
      const result = await llmService.process(text, configStore.getAll(), ctx);
      return { success: true, text: result.text };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Pipeline
  ipcMain.handle('pipeline:process', async (_e, buf: ArrayBuffer, ctx: any) => {
    const cfg = configStore.getAll();
    const sttProvider = cfg.sttProvider || 'siliconflow';
    const llmProvider = cfg.llmProvider || 'siliconflow';
    const sttModel = sttProvider === 'siliconflow' ? cfg.siliconflowSttModel : cfg.openaiSttModel;
    const llmModel = llmProvider === 'siliconflow' ? cfg.siliconflowLlmModel
      : llmProvider === 'openrouter' ? cfg.openrouterLlmModel : cfg.openaiLlmModel;

    let sttDurationMs = 0;
    let llmDurationMs = 0;

    try {
      // Stage 1: STT with timing
      console.log('[Pipeline] STT via', sttProvider, sttModel);
      const sttStart = Date.now();
      const raw = await sttService.transcribe(Buffer.from(buf), cfg, ctx);
      sttDurationMs = Date.now() - sttStart;
      console.log('[Pipeline] STT done in', sttDurationMs, 'ms:', raw.slice(0, 100));

      if (!raw.trim()) return { success: true, rawText: '', processedText: '', skipped: true, sttDurationMs };

      // Stage 2: LLM with timing
      console.log('[Pipeline] LLM via', llmProvider, llmModel);
      const llmStart = Date.now();
      const llmResult = await llmService.process(raw, cfg, ctx);
      llmDurationMs = Date.now() - llmStart;
      console.log('[Pipeline] LLM done in', llmDurationMs, 'ms:', llmResult.text.slice(0, 100));

      // Auto-dictionary: extract proper nouns
      let autoLearnedTerms: string[] = [];
      if (cfg.autoLearnDictionary !== false) {
        const dict: string[] = cfg.personalDictionary || [];
        autoLearnedTerms = extractDictionaryTerms(llmResult.text, dict);
        if (autoLearnedTerms.length > 0) {
          const updated = [...dict, ...autoLearnedTerms];
          configStore.set('personalDictionary', updated);
          console.log('[AutoDict] learned:', autoLearnedTerms);
          mainWindow?.webContents.send('dictionary:auto-added', autoLearnedTerms);
        }
      }

      // Unmute after pipeline completes (in case recording stopped during pipeline)
      isRecording = false;
      if (cfg.autoMuteOnRecord) setSystemMute(false);

      return {
        success: true,
        rawText: raw,
        processedText: llmResult.text,
        systemPrompt: llmResult.systemPrompt,
        sttProvider, llmProvider, sttModel, llmModel,
        sttDurationMs, llmDurationMs, autoLearnedTerms,
      };
    } catch (e: any) {
      isRecording = false;
      if (cfg.autoMuteOnRecord) setSystemMute(false);
      return { success: false, error: e.message, sttProvider, llmProvider, sttModel, llmModel, sttDurationMs, llmDurationMs };
    }
  });

  // Rewrite (Voice Superpowers)
  ipcMain.handle('llm:rewrite', async (_e, text: string, instruction: string) => {
    try {
      const result = await llmService.rewrite(text, instruction, configStore.getAll());
      return { success: true, text: result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // Clipboard
  ipcMain.handle('clipboard:write', (_e, text: string) => { clipboard.writeText(text); return true; });

  // Type text at cursor (clipboard + paste simulation)
  ipcMain.handle('text:typeAtCursor', async (_e, text: string) => {
    try {
      // Save current clipboard content
      const prevClipboard = clipboard.readText();

      // Write new text to clipboard
      clipboard.writeText(text);

      // Small delay to ensure clipboard is updated
      await new Promise((r) => setTimeout(r, 50));

      // Simulate paste keystroke
      if (isMac) {
        execSync(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`);
      } else if (process.platform === 'win32') {
        execSync(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')"`);
      } else {
        // Linux
        try {
          execSync('xdotool key ctrl+v');
        } catch {
          // xdotool not available, try xclip approach
          execSync('xsel --clipboard --output | xargs -0 xdotool type --');
        }
      }

      // Restore previous clipboard content after a delay
      setTimeout(() => {
        try { clipboard.writeText(prevClipboard); } catch {}
      }, 500);

      return { success: true };
    } catch (e: any) {
      console.error('[TypeText] error:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.hide());
  ipcMain.handle('window:hideOverlay', () => {
    if (!overlayWindow) return;
    overlayWindow.hide();
    // Reset overlay size back to pill
    const display = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = display.workAreaSize;
    const pillW = 280, pillH = 56;
    overlayWindow.setBounds({
      width: pillW, height: pillH,
      x: Math.round((screenW - pillW) / 2),
      y: screenH - pillH - 16,
    });
  });
  ipcMain.handle('window:resizeOverlay', (_e, w: number, h: number) => {
    if (!overlayWindow) return;
    const display = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = display.workAreaSize;
    overlayWindow.setBounds({
      width: w, height: h,
      x: Math.round((screenW - w) / 2),
      y: screenH - h - 16,
    });
  });

  // Auto updater
  ipcMain.handle('updater:check', () => autoUpdater.checkForUpdates().catch(() => null));
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate().catch(() => null));
  ipcMain.handle('updater:install', () => {
    quitting = true;
    autoUpdater.quitAndInstall();
  });
  ipcMain.handle('updater:getVersion', () => app.getVersion());

  // Context awareness — await OCR if it was started during toggleRecording
  ipcMain.handle('context:getLastContext', async () => {
    if (ocrPromise) {
      try {
        const ocrResult = await ocrPromise;
        if (ocrResult) {
          lastCapturedContext.screenContext = ocrResult.text;
          lastCapturedContext.screenshotDataUrl = ocrResult.screenshot;
        }
      } catch (e: any) {
        console.error('[Context] OCR await error:', e.message);
      }
      ocrPromise = null;
    }
    return lastCapturedContext;
  });

  ipcMain.handle('context:checkAccessibility', () => {
    if (!isMac) return 'granted';
    return systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined';
  });

  ipcMain.handle('context:requestAccessibility', () => {
    if (!isMac) return true;
    return systemPreferences.isTrustedAccessibilityClient(true);
  });

  ipcMain.handle('context:checkScreenPermission', () => {
    if (!isMac) return 'granted';
    return systemPreferences.getMediaAccessStatus('screen');
  });

  ipcMain.handle('context:captureAndOcr', async () => {
    const cfg = configStore.getAll();
    if (!cfg.contextOcrEnabled) return null;
    try {
      const result = await captureScreenAndOcr(cfg);
      return result?.text || null;
    } catch (e: any) {
      console.error('[Context OCR] error:', e.message);
      return null;
    }
  });

  // API test
  ipcMain.handle('api:test', async (_e, provider: string) => {
    try {
      const msg = await llmService.testConnection(configStore.getAll(), provider);
      return { success: true, message: msg };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });
}

// ─── Auto Updater ──────────────────────────────────────────────────────────

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] update available:', info.version);
    mainWindow?.webContents.send('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] no update available');
    mainWindow?.webContents.send('updater:update-not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:download-progress', {
      percent: Math.round(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] update downloaded');
    mainWindow?.webContents.send('updater:update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] error:', err.message);
    mainWindow?.webContents.send('updater:error', err.message);
  });

  // Check for updates 3 seconds after launch (non-blocking)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 3000);
}

// ─── App Lifecycle ──────────────────────────────────────────────────────────

app.whenReady().then(() => {
  configStore = new ConfigStore();
  sttService = new STTService();
  llmService = new LLMService();

  setupPermissions();
  createMainWindow();
  createOverlayWindow();
  createTray();
  registerShortcuts();
  setupIPC();
  if (!isDev) setupAutoUpdater();

  // macOS Dock menu
  if (isMac && app.dock) {
    const dockMenu = Menu.buildFromTemplate([
      { label: 'Start Dictation', click: toggleRecording },
      { type: 'separator' },
      { label: 'Settings', click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('navigate', 'settings'); } },
    ]);
    app.dock.setMenu(dockMenu);
  }

  app.on('activate', () => mainWindow?.show());
});

app.on('will-quit', () => globalShortcut.unregisterAll());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

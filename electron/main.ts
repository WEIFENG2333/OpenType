import {
  app, BrowserWindow, globalShortcut, ipcMain,
  Tray, Menu, nativeImage, clipboard,
  session, systemPreferences, screen, desktopCapturer,
} from 'electron';
import path from 'path';
import { execSync, ChildProcess, spawn } from 'child_process';
import readline from 'readline';
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
let shortcutsSuspended = false;
let suppressActivateUntil = 0; // prevent main window popup right after overlay hides
let savedSystemVolume: number | null = null; // saved volume before mute
let savedSystemMuted = false;               // was system already muted?
const isWin = process.platform === 'win32';

// Windows: PowerShell Core Audio interop for master volume control.
// Uses IAudioEndpointVolume via MMDeviceEnumerator (works on Windows 7+).
const WIN_AUDIO_HELPER = [
  'Add-Type @"',
  'using System; using System.Runtime.InteropServices;',
  '[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
  'public interface IAudioEndpointVolume {',
  '  int _r0(); int _r1(); int _r2(); int _r3(); int _r4(); int _r5(); int _r6(); int _r7(); int _r8(); int _r9(); int _r10(); int _r11();',
  '  int GetMasterVolumeLevelScalar(out float l);',
  '  int SetMasterVolumeLevelScalar(float l, ref Guid ctx);',
  '  int _r14();',
  '  int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid ctx);',
  '  int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);',
  '}',
  '[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
  'public interface IMMDevice { int Activate(ref Guid iid, int ctx, IntPtr p, out IAudioEndpointVolume ep); }',
  '[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]',
  'public interface IMMDeviceEnumerator { int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }',
  '[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] public class MMDeviceEnumerator {}',
  '"@',
].join('\n');

function winAudioCmd(action: 'mute' | 'unmute' | 'getVol' | 'setVol', vol = 0): string {
  const setup = `${WIN_AUDIO_HELPER}
$e=New-Object MMDeviceEnumerator; $d=$null; $null=$e.GetDefaultAudioEndpoint(0,1,[ref]$d);
$iid=[Guid]'5CDF2C82-841E-4546-9722-0CF74078229A'; $ep=$null; $null=$d.Activate([ref]$iid,1,[IntPtr]::Zero,[ref]$ep);
$g=[Guid]::Empty`;
  if (action === 'getVol') return `${setup}; $v=0.0; $null=$ep.GetMasterVolumeLevelScalar([ref]$v); $m=$false; $null=$ep.GetMute([ref]$m); Write-Host "$([math]::Round($v*100)),$m"`;
  if (action === 'mute') return `${setup}; $null=$ep.SetMute($true,[ref]$g)`;
  if (action === 'unmute') return `${setup}; $null=$ep.SetMute($false,[ref]$g)`;
  // setVol
  return `${setup}; $null=$ep.SetMasterVolumeLevelScalar(${(vol / 100).toFixed(2)},[ref]$g); $null=$ep.SetMute($false,[ref]$g)`;
}

function muteSystemAudio() {
  try {
    if (isMac) {
      const vol = execSync("osascript -e 'output volume of (get volume settings)'", { timeout: 1000 }).toString().trim();
      savedSystemVolume = parseInt(vol, 10) || null;
      execSync("osascript -e 'set volume output volume 0'", { timeout: 1000 });
    } else if (isWin) {
      const out = execSync(`powershell -NoProfile -Command "${winAudioCmd('getVol')}"`, { timeout: 3000 }).toString().trim();
      const [volStr, mutedStr] = out.split(',');
      savedSystemVolume = parseInt(volStr, 10);
      savedSystemMuted = mutedStr?.trim() === 'True';
      if (isNaN(savedSystemVolume)) { savedSystemVolume = null; return; }
      execSync(`powershell -NoProfile -Command "${winAudioCmd('mute')}"`, { timeout: 3000 });
    }
  } catch (e) {
    console.error('[Mute] failed:', e);
  }
}

function restoreSystemAudio() {
  if (savedSystemVolume == null) return;
  try {
    if (isMac) {
      execSync(`osascript -e 'set volume output volume ${savedSystemVolume}'`, { timeout: 1000 });
    } else if (isWin) {
      if (savedSystemMuted) {
        // Was already muted — leave it muted
      } else {
        execSync(`powershell -NoProfile -Command "${winAudioCmd('unmute')}"`, { timeout: 3000 });
      }
    }
  } catch (e) {
    console.error('[Unmute] failed:', e);
  }
  savedSystemVolume = null;
  savedSystemMuted = false;
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
  // Enhanced L1 accessibility attributes
  fieldRoleDescription?: string;  // AXRoleDescription: "text field", "search field"
  fieldLabel?: string;            // AXDescription/AXTitle: "Message body", "Subject"
  fieldPlaceholder?: string;      // AXPlaceholderValue: "Type a message..."
  cursorPosition?: number;        // from AXSelectedTextRange when selection length=0
  selectionRange?: { location: number; length: number }; // AXSelectedTextRange
  numberOfCharacters?: number;    // AXNumberOfCharacters
  insertionLineNumber?: number;   // AXInsertionPointLineNumber
  // Other context
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

    const raw = execSync('osascript -', { input: script, timeout: 2000 }).toString().trim();
    const parts = raw.split(SEP);

    ctx.appName = parts[0] || undefined;
    ctx.bundleId = parts[1] || undefined;
    ctx.windowTitle = parts[2] || undefined;
    ctx.fieldRole = parts[3] || undefined;
    ctx.selectedText = parts[4] || undefined;
    ctx.fieldRoleDescription = parts[5] || undefined;
    ctx.fieldLabel = parts[6] || undefined;
    ctx.fieldPlaceholder = parts[7] || undefined;

    // Parse AXSelectedTextRange from "location,length" format
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

    // Parse AXNumberOfCharacters
    if (parts[9]) {
      const n = parseInt(parts[9], 10);
      if (!isNaN(n)) ctx.numberOfCharacters = n;
    }

    // Parse AXInsertionPointLineNumber
    if (parts[10]) {
      const n = parseInt(parts[10], 10);
      if (!isNaN(n)) ctx.insertionLineNumber = n;
    }

    // fieldText is always last — may contain separators, so join remainder
    ctx.fieldText = parts.slice(11).join(SEP) || undefined;

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
    const raw = execSync(`powershell -Command "${ps.replace(/"/g, '\\"')}"`, { timeout: 3000 }).toString().trim();
    const parts = raw.split('|||');
    ctx.appName = parts[0] || undefined;
    ctx.windowTitle = parts[1] || undefined;
    ctx.fieldRole = parts[2] || undefined;
    ctx.selectedText = parts[3] || undefined;
    ctx.fieldLabel = parts[4] || undefined;
    ctx.fieldPlaceholder = parts[5] || undefined;
    // Parse selection range
    if (parts[6] && parts[7]) {
      const loc = parseInt(parts[6], 10);
      const len = parseInt(parts[7], 10);
      if (!isNaN(loc) && !isNaN(len)) {
        ctx.selectionRange = { location: loc, length: len };
        if (len === 0) ctx.cursorPosition = loc;
      }
    }
    // fieldText is last (may contain separator)
    ctx.fieldText = parts.slice(8).join('|||') || undefined;
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
      const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);
      const hasAccessibility = l1Enabled && accessibilityGranted;
      if (l1Enabled && !accessibilityGranted) console.warn('[Context] L1 enabled but accessibility permission not granted');
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
  const model = config.contextOcrModel || 'Qwen/Qwen2.5-VL-32B-Instruct';
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    if (!sources.length) { console.warn('[OCR] no screen sources'); return null; }

    const thumbnail = sources[0].thumbnail;
    const jpegBuffer = thumbnail.toJPEG(80);
    const base64 = jpegBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const t0 = Date.now();
    const ocrResult = await llmService.analyzeScreenshot(dataUrl, config);
    console.log(`[OCR] ${model} → ${Date.now() - t0}ms, ${ocrResult.length} chars`);
    return { text: ocrResult, screenshot: dataUrl };
  } catch (e: any) {
    console.error('[OCR] error:', e.message);
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
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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
  const overlayW = 140;
  const overlayH = 40;

  overlayWindow = new BrowserWindow({
    width: overlayW,
    height: overlayH,
    x: Math.round((screenW - overlayW) / 2),
    y: screenH - overlayH - 8,
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
    show: true,
    opacity: 0,
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

// ─── App Menu ────────────────────────────────────────────────────────────────

function setupAppMenu() {
  const devTools = isDev ? [
    { type: 'separator' as const },
    { role: 'toggleDevTools' as const },
    { role: 'forceReload' as const },
  ] : [];

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        ...devTools,
      ],
    },
    {
      role: 'editMenu' as const,
    },
    {
      role: 'windowMenu' as const,
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Keyboard shortcut: Cmd+Option+I (dev only)
  if (isDev) {
    globalShortcut.register('CommandOrControl+Option+I', () => {
      const win = BrowserWindow.getFocusedWindow();
      win?.webContents.toggleDevTools();
    });
  }
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

// ─── Fn Key Monitor (macOS only) ─────────────────────────────────────────────

let fnMonitorProcess: ChildProcess | null = null;

function getFnMonitorPath(): string {
  if (isDev) {
    return path.join(app.getAppPath(), 'native', 'fn-monitor');
  }
  // In packaged app, the binary is in the Resources folder
  return path.join(process.resourcesPath, 'native', 'fn-monitor');
}

function startFnMonitor() {
  stopFnMonitor();
  if (!isMac) return;

  // Fn monitor requires Accessibility permission
  if (!systemPreferences.isTrustedAccessibilityClient(false)) {
    console.warn('[FnMonitor] skipped — Accessibility permission not granted');
    return;
  }

  const binPath = getFnMonitorPath();
  try {
    fnMonitorProcess = spawn(binPath, [], { stdio: ['ignore', 'pipe', 'pipe'] });
    const rl = readline.createInterface({ input: fnMonitorProcess.stdout! });

    let fnHeld = false;
    const fnComboShortcuts: string[] = []; // tracks currently registered Fn+X shortcuts

    function registerFnCombos() {
      unregisterFnCombos();
      const hotkey = configStore.get('globalHotkey') || '';
      const pttKey = configStore.get('pushToTalkKey') || '';

      // Register the non-Fn part as a temporary globalShortcut while Fn is held
      if (hotkey.startsWith('Fn+')) {
        const rest = hotkey.slice(3);
        try {
          globalShortcut.register(rest, toggleRecording);
          fnComboShortcuts.push(rest);
        } catch (e) { console.error('[FnCombo] register failed:', rest, e); }
      }
      if (pttKey.startsWith('Fn+')) {
        const rest = pttKey.slice(3);
        if (!fnComboShortcuts.includes(rest)) {
          try {
            globalShortcut.register(rest, () => {
              const inputMode = configStore.get('inputMode') || 'toggle';
              if (inputMode === 'pushToTalk') toggleRecording();
            });
            fnComboShortcuts.push(rest);
          } catch (e) { console.error('[FnCombo] register failed:', rest, e); }
        }
      }
    }

    function unregisterFnCombos() {
      for (const key of fnComboShortcuts) {
        try { globalShortcut.unregister(key); } catch (_) {}
      }
      fnComboShortcuts.length = 0;
    }

    rl.on('line', (line: string) => {
      const trimmed = line.trim();

      // Broadcast Fn events to all windows (for HotkeyCapture detection)
      if (trimmed === 'fn-down' || trimmed === 'fn-up') {
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('fn-key-event', trimmed);
        }
      }

      // Track Fn state
      if (trimmed === 'fn-down') fnHeld = true;
      if (trimmed === 'fn-up') fnHeld = false;

      // Skip hotkey triggers while shortcuts are suspended (e.g. during hotkey capture)
      if (shortcutsSuspended) return;

      const hotkey = configStore.get('globalHotkey') || '';
      const pttKey = configStore.get('pushToTalkKey') || '';
      const inputMode = configStore.get('inputMode') || 'toggle';

      if (trimmed === 'fn-down') {
        // Solo Fn hotkeys — trigger immediately on Fn press
        if (hotkey === 'Fn') toggleRecording();
        if (inputMode === 'pushToTalk' && pttKey === 'Fn' && !isRecording) toggleRecording();

        // Fn+X combos — register the X part as temporary shortcut while Fn held
        const hasFnCombo = [hotkey, pttKey].some((k) => k.startsWith('Fn+'));
        if (hasFnCombo) registerFnCombos();
      }

      if (trimmed === 'fn-up') {
        // Solo Fn push-to-talk release
        if (inputMode === 'pushToTalk' && pttKey === 'Fn' && isRecording) toggleRecording();

        // Clean up Fn+X combo shortcuts
        unregisterFnCombos();

        // Re-register normal shortcuts that may have been displaced
        registerShortcuts();
      }
    });

    fnMonitorProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[FnMonitor]', data.toString().trim());
    });

    fnMonitorProcess.on('exit', (code) => {
      console.log('[FnMonitor] exited with code', code);
      fnMonitorProcess = null;
    });

    console.log('[FnMonitor] started');
  } catch (e) {
    console.error('[FnMonitor] failed to start:', e);
  }
}

function stopFnMonitor() {
  if (fnMonitorProcess) {
    fnMonitorProcess.kill();
    fnMonitorProcess = null;
  }
}

function needsFnMonitor(): boolean {
  if (!isMac) return false;
  const hotkey = configStore.get('globalHotkey') || '';
  const pttKey = configStore.get('pushToTalkKey') || '';
  const pasteKey = configStore.get('pasteLastKey') || '';
  return [hotkey, pttKey, pasteKey].some((k) => k === 'Fn' || k.startsWith('Fn+'));
}

// ─── Global Shortcut ────────────────────────────────────────────────────────

function registerShortcuts() {
  globalShortcut.unregisterAll();

  const key = configStore.get('globalHotkey') || 'CommandOrControl+Shift+Space';

  // Fn and Fn+X combos are handled by native monitor, not globalShortcut
  if (key !== 'Fn' && !key.startsWith('Fn+')) {
    try {
      globalShortcut.register(key, toggleRecording);
      console.log('[Shortcut] registered:', key);
    } catch (e) {
      console.error('[Shortcut] register failed:', key, e);
    }
  }

  // Always start Fn monitor on macOS (needed for hotkey capture + Fn hotkey)
  if (isMac) {
    startFnMonitor();
  }
}

function toggleRecording() {
  const cfg = configStore.getAll();
  isRecording = !isRecording;

  // Show overlay + send toggle IMMEDIATELY for instant feedback
  if (overlayWindow) {
    const activeDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { x: dX, y: dY, width: dW, height: dH } = activeDisplay.workArea;
    const pillW = 140, pillH = 40;
    overlayWindow.setBounds({
      width: pillW, height: pillH,
      x: dX + Math.round((dW - pillW) / 2),
      y: dY + dH - pillH - 8,
    });
    overlayWindow.setOpacity(1);
    overlayWindow.webContents.send('toggle-recording');
  }

  // Mute/restore system audio if enabled
  if (isRecording && cfg.muteSystemAudio) {
    muteSystemAudio();
  } else if (!isRecording && savedSystemVolume != null) {
    restoreSystemAudio();
  }

  // Defer context capture so overlay + recording IPC is delivered and rendered first
  if (isRecording) {
    setTimeout(() => {
      lastCapturedContext = captureFullContext(cfg);

      const ctx = lastCapturedContext;
      console.log(`[Context] app=${ctx.appName}${ctx.url ? ' url=' + ctx.url.slice(0, 60) : ''}`);
      console.log(`[Context] field=${ctx.fieldRole || '—'} label=${ctx.fieldLabel || '—'} cursor=${ctx.cursorPosition ?? '—'} chars=${ctx.numberOfCharacters ?? '—'}`);
      console.log(`[Context] selected=${ctx.selectedText ? `"${ctx.selectedText.slice(0, 80)}"` : '—'} | fieldText=${ctx.fieldText ? ctx.fieldText.length + 'c' : '—'} | clipboard=${ctx.clipboardText ? ctx.clipboardText.length + 'c' : '—'}`);

      // Start OCR in background if enabled (runs while user speaks)
      if (cfg.contextOcrEnabled) {
        ocrPromise = captureScreenAndOcr(cfg);
      } else {
        ocrPromise = null;
      }
    }, 50);
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

  ipcMain.handle('shortcuts:suspend', () => {
    globalShortcut.unregisterAll();
    shortcutsSuspended = true;
    return true;
  });

  ipcMain.handle('shortcuts:resume', () => {
    shortcutsSuspended = false;
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
        const dictEntries: any[] = cfg.personalDictionary || [];
        const dictWords: string[] = dictEntries.map((e: any) => typeof e === 'string' ? e : e.word);
        autoLearnedTerms = extractDictionaryTerms(llmResult.text, dictWords);
        if (autoLearnedTerms.length > 0) {
          const newEntries = autoLearnedTerms.map((w) => ({
            word: w, source: 'auto' as const, addedAt: Date.now(),
          }));
          const updated = [...dictEntries, ...newEntries];
          configStore.set('personalDictionary', updated);
          console.log('[AutoDict] learned:', autoLearnedTerms);
          mainWindow?.webContents.send('dictionary:auto-added', autoLearnedTerms);
        }
      }

      // Unmute after pipeline completes (in case recording stopped during pipeline)
      isRecording = false;

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

      // Re-activate the original target app before pasting (in case overlay click stole activation)
      if (isMac) {
        const bid = lastCapturedContext?.bundleId;
        const targetApp = lastCapturedContext?.appName;
        if (bid) {
          try {
            execSync(`osascript -e 'tell application id "${bid}" to activate'`, { timeout: 1500 });
            await new Promise((r) => setTimeout(r, 120));
          } catch {
            if (targetApp) {
              try {
                execSync(`osascript -e 'tell application "${targetApp}" to activate'`, { timeout: 1500 });
                await new Promise((r) => setTimeout(r, 120));
              } catch {}
            }
          }
        }
      }

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
    isRecording = false;
    suppressActivateUntil = Date.now() + 600;
    if (!overlayWindow) return;
    overlayWindow.setOpacity(0);
    // Hide the app so macOS deactivates it — next Dock click will trigger 'activate' and show mainWindow
    if (isMac) app.hide();
    // Reset overlay size back to pill (use primary display as fallback, will reposition on next show)
    const display = screen.getPrimaryDisplay();
    const { x: dX, y: dY, width: dW, height: dH } = display.workArea;
    const pillW = 140, pillH = 40;
    overlayWindow.setBounds({
      width: pillW, height: pillH,
      x: dX + Math.round((dW - pillW) / 2),
      y: dY + dH - pillH - 8,
    });
  });
  ipcMain.handle('window:resizeOverlay', (_e, w: number, h: number) => {
    if (!overlayWindow) return;
    // Use the display the overlay is currently on
    const overlayBounds = overlayWindow.getBounds();
    const display = screen.getDisplayNearestPoint({ x: overlayBounds.x, y: overlayBounds.y });
    const { x: dX, y: dY, width: dW, height: dH } = display.workArea;
    overlayWindow.setBounds({
      width: w, height: h,
      x: dX + Math.round((dW - w) / 2),
      y: dY + dH - h - 8,
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
        } else {
          console.warn('[OCR] result empty, skipping context merge');
        }
      } catch (e: any) {
        console.error('[OCR] await error:', e.message);
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

  ipcMain.handle('context:openScreenPrefs', () => {
    if (isMac) {
      require('child_process').exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"');
    }
    return true;
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

  // Audio devices
  ipcMain.handle('audio:devices', async () => {
    // Renderer enumerates devices via navigator.mediaDevices; this is a fallback
    return [];
  });

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

  // macOS: request Accessibility permission upfront (needed for context capture, Fn key, type-at-cursor)
  if (isMac) {
    systemPreferences.isTrustedAccessibilityClient(true); // triggers system prompt if not granted
  }

  createMainWindow();
  createOverlayWindow();
  createTray();
  registerShortcuts();
  setupIPC();
  if (!isDev) setupAutoUpdater();
  setupAppMenu();

  // macOS Dock menu
  if (isMac && app.dock) {
    const dockMenu = Menu.buildFromTemplate([
      { label: 'Start Dictation', click: toggleRecording },
      { type: 'separator' },
      { label: 'Settings', click: () => { mainWindow?.show(); mainWindow?.focus(); mainWindow?.webContents.send('navigate', 'settings'); } },
    ]);
    app.dock.setMenu(dockMenu);
  }

  app.on('activate', () => {
    // Don't show main window while overlay is visible, during recording, or right after overlay hides
    if (isRecording || (overlayWindow?.getOpacity() ?? 0) > 0 || Date.now() < suppressActivateUntil) return;
    mainWindow?.show();
  });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); stopFnMonitor(); });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

import { exec, execSync } from 'child_process';
import { state, isMac, isWin } from './app-state';

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
  return `${setup}; $null=$ep.SetMasterVolumeLevelScalar(${(vol / 100).toFixed(2)},[ref]$g); $null=$ep.SetMute($false,[ref]$g)`;
}

function execAsync(cmd: string, timeout = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString().trim());
    });
  });
}

// Chain all mute/restore operations to prevent interleaving
let muteChain: Promise<void> = Promise.resolve();

export function muteSystemAudio() {
  const prev = muteChain;
  muteChain = prev.then(async () => {
    try {
      if (isMac) {
        const vol = await execAsync("osascript -e 'output volume of (get volume settings)'");
        state.savedSystemVolume = parseInt(vol, 10) || null;
        await execAsync("osascript -e 'set volume output volume 0'");
        console.log('[Mute] done');
      } else if (isWin) {
        const out = await execAsync(`powershell -NoProfile -Command "${winAudioCmd('getVol')}"`, 3000);
        const [volStr, mutedStr] = out.split(',');
        state.savedSystemVolume = parseInt(volStr, 10);
        state.savedSystemMuted = mutedStr?.trim() === 'True';
        if (isNaN(state.savedSystemVolume)) { state.savedSystemVolume = null; return; }
        await execAsync(`powershell -NoProfile -Command "${winAudioCmd('mute')}"`, 3000);
        console.log('[Mute] done');
      }
    } catch (e) {
      console.error('[Mute] failed:', e);
    }
  });
}

/** Synchronous restore — for use in app quit handler where async won't complete */
export function restoreSystemAudioSync() {
  if (state.savedSystemVolume == null) return;
  const vol = state.savedSystemVolume;
  state.savedSystemVolume = null;
  state.savedSystemMuted = false;
  try {
    if (isMac) {
      execSync(`osascript -e 'set volume output volume ${vol}'`, { timeout: 1000 });
    } else if (isWin) {
      execSync(`powershell -NoProfile -Command "${winAudioCmd('unmute')}"`, { timeout: 2000 });
    }
  } catch {}
}

export function restoreSystemAudio() {
  const prev = muteChain;
  muteChain = prev.then(async () => {
    if (state.savedSystemVolume == null) {
      console.log('[Unmute] skipped — no saved volume');
      return;
    }
    const vol = state.savedSystemVolume;
    const wasMuted = state.savedSystemMuted;
    state.savedSystemVolume = null;
    state.savedSystemMuted = false;

    try {
      if (isMac) {
        await execAsync(`osascript -e 'set volume output volume ${vol}'`);
        console.log('[Unmute] done');
      } else if (isWin) {
        if (!wasMuted) {
          await execAsync(`powershell -NoProfile -Command "${winAudioCmd('unmute')}"`, 3000);
          console.log('[Unmute] done');
        }
      }
    } catch (e) {
      console.error('[Unmute] failed:', e);
    }
  });
}

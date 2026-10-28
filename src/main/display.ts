import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

// Windows HDR on the screen Kalli's window is on (cinema mode), through the DisplayConfig API in PowerShell.
// Never on Linux: mpv under XWayland can't send an HDR picture anyway.

/** `id`: Windows' device name (\\.\DISPLAY1). `hdr`: whether HDR is on, undefined when the display can't do HDR. */
export type Screen = { id: string; hdr?: boolean }

const run = promisify(execFile)

// Inputs reach the script through environment variables only, never spliced into its text.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class KalliDisplay {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct MONITORINFOEX {
    public int cbSize, left, top, right, bottom, workLeft, workTop, workRight, workBottom, flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string device;
  }
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, int flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX info);
  public static string DeviceOf(long hwnd) {
    var info = new MONITORINFOEX();
    info.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
    GetMonitorInfo(MonitorFromWindow(new IntPtr(hwnd), 2), ref info);
    return info.device;
  }

  // --- HDR ("advanced color") lives in the DisplayConfig API, per target: the GDI device name leads to it. ---
  [StructLayout(LayoutKind.Sequential)] public struct LUID { public uint Low; public int High; }
  [StructLayout(LayoutKind.Sequential)] public struct HEADER { public int type, size; public LUID adapter; public uint id; }
  [StructLayout(LayoutKind.Sequential)]
  public struct PATH {
    public LUID sourceAdapter; public uint sourceId, sourceMode, sourceFlags;
    public LUID targetAdapter; public uint targetId, targetMode; public int tech, rotation, scaling;
    public uint refreshNum, refreshDen; public int scanline, available; public uint targetFlags, flags;
  }
  [StructLayout(LayoutKind.Sequential)]
  public struct MODE { public uint infoType, id; public LUID adapter; [MarshalAs(UnmanagedType.ByValArray, SizeConst = 48)] public byte[] data; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct SOURCE_NAME { public HEADER header; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string device; }
  [StructLayout(LayoutKind.Sequential)] public struct COLOR_INFO { public HEADER header; public uint value; public int encoding; public uint bits; }
  [StructLayout(LayoutKind.Sequential)] public struct COLOR_STATE { public HEADER header; public uint value; }
  [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint flags, out uint paths, out uint modes);
  [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint flags, ref uint np, [Out] PATH[] paths, ref uint nm, [Out] MODE[] modes, IntPtr topology);
  [DllImport("user32.dll")] static extern int DisplayConfigGetDeviceInfo(ref SOURCE_NAME info);
  [DllImport("user32.dll")] static extern int DisplayConfigGetDeviceInfo(ref COLOR_INFO info);
  [DllImport("user32.dll")] static extern int DisplayConfigSetDeviceInfo(ref COLOR_STATE info);
  static bool Target(string device, out HEADER target) {
    target = new HEADER();
    uint np, nm;
    if (GetDisplayConfigBufferSizes(2, out np, out nm) != 0) return false; // QDC_ONLY_ACTIVE_PATHS
    var paths = new PATH[np];
    var modes = new MODE[nm];
    if (QueryDisplayConfig(2, ref np, paths, ref nm, modes, IntPtr.Zero) != 0) return false;
    for (int i = 0; i < np; i++) {
      var name = new SOURCE_NAME();
      name.header.type = 1; // GET_SOURCE_NAME
      name.header.size = Marshal.SizeOf(typeof(SOURCE_NAME));
      name.header.adapter = paths[i].sourceAdapter;
      name.header.id = paths[i].sourceId;
      if (DisplayConfigGetDeviceInfo(ref name) != 0 || name.device != device) continue;
      target.adapter = paths[i].targetAdapter;
      target.id = paths[i].targetId;
      return true;
    }
    return false;
  }
  // -1: the display can't do HDR; 0 off; 1 on.
  public static int Hdr(string device) {
    HEADER t;
    if (!Target(device, out t)) return -1;
    var info = new COLOR_INFO();
    info.header = t;
    info.header.type = 9; // GET_ADVANCED_COLOR_INFO
    info.header.size = Marshal.SizeOf(typeof(COLOR_INFO));
    if (DisplayConfigGetDeviceInfo(ref info) != 0 || (info.value & 1) == 0) return -1;
    return (info.value & 2) != 0 ? 1 : 0;
  }
  public static int SetHdr(string device, bool on) {
    HEADER t;
    if (!Target(device, out t)) return -1;
    var s = new COLOR_STATE();
    s.header = t;
    s.header.type = 10; // SET_ADVANCED_COLOR_STATE
    s.header.size = Marshal.SizeOf(typeof(COLOR_STATE));
    s.value = on ? 1u : 0u;
    return DisplayConfigSetDeviceInfo(ref s);
  }
}
'@
$d = $env:KALLI_DISPLAY_DEVICE
if ($env:KALLI_DISPLAY_DO -eq 'list') {
  $d = [KalliDisplay]::DeviceOf([long]$env:KALLI_DISPLAY_HWND)
  ConvertTo-Json -Compress -InputObject @{ device = $d; hdr = [KalliDisplay]::Hdr($d) }
} else {
  [KalliDisplay]::SetHdr($d, $env:KALLI_DISPLAY_HDR -eq '1')
}
`

const ENCODED = Buffer.from(SCRIPT, 'utf16le').toString('base64')

const powershell = (env: Record<string, string>) =>
  run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', ENCODED], {
    env: { ...process.env, ...env },
    timeout: 20_000,
    windowsHide: true
  })

/** The screen Kalli's window is on, by its handle; undefined off Windows. */
export async function screenOf(hwnd: string): Promise<Screen | undefined> {
  if (process.platform !== 'win32') return undefined
  const { stdout } = await powershell({ KALLI_DISPLAY_DO: 'list', KALLI_DISPLAY_HWND: hwnd })
  const r = JSON.parse(stdout) as { device: string; hdr: number }
  return { id: r.device, hdr: r.hdr < 0 ? undefined : r.hdr === 1 }
}

/** Windows HDR on or off for one display (what Settings → Display → Use HDR does). */
export async function setHdr(device: string, on: boolean) {
  if (process.platform !== 'win32') return
  const { stdout } = await powershell({ KALLI_DISPLAY_DO: 'hdr', KALLI_DISPLAY_DEVICE: device, KALLI_DISPLAY_HDR: on ? '1' : '0' })
  if (stdout.trim() !== '0') throw new Error(`DisplayConfigSetDeviceInfo ${stdout.trim()}`)
}

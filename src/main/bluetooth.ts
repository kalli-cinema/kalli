import { execFile } from 'node:child_process'
import type { BtDevice } from '../shared/types.ts'

// Bluetooth controllers without Windows Settings: list the paired ones, search for ones in pairing mode, pair and
// forget. Windows' own pairing API (WinRT) through PowerShell, which every Windows 10/11 has; nothing to install.
// ponytail: Windows only; Linux would drive `bluetoothctl` the same way.

export const supported = process.platform === 'win32'

// Inputs reach the script through environment variables only, never spliced into its text.
const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation${'`'}1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $null = $task.Wait(-1); $task.Result }
$null = [Windows.Devices.Enumeration.DeviceInformation,Windows.Devices.Enumeration,ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$null = [Windows.Devices.Bluetooth.BluetoothLEDevice,Windows.Devices.Bluetooth,ContentType=WindowsRuntime]
$DI = [Windows.Devices.Enumeration.DeviceInformation]
# Peripheral major class (5) with the joystick (1) or gamepad (2) subtype.
function IsPad($cod) { (($cod -shr 8) -band 0x1F) -eq 5 -and @(1, 2) -contains (($cod -shr 2) -band 0x0F) }
$mode = $env:KALLI_BT_MODE
$out = @()
if ($mode -eq 'paired') {
  foreach ($le in $false, $true) {
    $sel = if ($le) { [Windows.Devices.Bluetooth.BluetoothLEDevice]::GetDeviceSelectorFromPairingState($true) } else { [Windows.Devices.Bluetooth.BluetoothDevice]::GetDeviceSelectorFromPairingState($true) }
    foreach ($d in (Await ($DI::FindAllAsync($sel)) ([Windows.Devices.Enumeration.DeviceInformationCollection]))) {
      try {
        if ($le) { $dev = Await ([Windows.Devices.Bluetooth.BluetoothLEDevice]::FromIdAsync($d.Id)) ([Windows.Devices.Bluetooth.BluetoothLEDevice]); $cod = 0; $pad = $dev.Appearance.Category -eq 0x0F }
        else { $dev = Await ([Windows.Devices.Bluetooth.BluetoothDevice]::FromIdAsync($d.Id)) ([Windows.Devices.Bluetooth.BluetoothDevice]); $cod = $dev.ClassOfDevice.RawValue; $pad = IsPad $cod }
        $out += @{ id = $d.Id; name = $d.Name; address = '{0:x12}' -f $dev.BluetoothAddress; connected = "$($dev.ConnectionStatus)" -eq 'Connected'; pad = [bool]$pad }
      } catch { }
    }
  }
} elseif ($mode -eq 'scan') {
  $aqs = '(System.Devices.Aep.ProtocolId:="{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}" OR System.Devices.Aep.ProtocolId:="{bb7bb05e-5972-42b5-94fc-76eaa7084d49}") AND System.Devices.Aep.IsPaired:=System.StructuredQueryType.Boolean#False'
  $props = [System.Collections.Generic.List[string]]@('System.Devices.Aep.DeviceAddress', 'System.Devices.Aep.Bluetooth.Cod.Major', 'System.Devices.Aep.Bluetooth.Cod.Minor')
  foreach ($d in (Await ($DI::FindAllAsync($aqs, $props, [Windows.Devices.Enumeration.DeviceInformationKind]::AssociationEndpoint)) ([Windows.Devices.Enumeration.DeviceInformationCollection]))) {
    $p = @{}; foreach ($kv in $d.Properties) { $p[$kv.Key] = $kv.Value }
    $major = $p['System.Devices.Aep.Bluetooth.Cod.Major']; $minor = $p['System.Devices.Aep.Bluetooth.Cod.Minor']
    $pad = $major -eq 5 -and @(1, 2) -contains (($minor) -band 0x0F)
    if ($d.Name -and $d.Pairing.CanPair) { $out += @{ id = $d.Id; name = $d.Name; address = "$($p['System.Devices.Aep.DeviceAddress'])".Replace(':', ''); connected = $false; pad = [bool]$pad } }
  }
} elseif ($mode -eq 'pair') {
  $d = Await ($DI::CreateFromIdAsync($env:KALLI_BT_ID)) ($DI)
  $r = Await ($d.Pairing.PairAsync()) ([Windows.Devices.Enumeration.DevicePairingResult])
  $out = @{ status = "$($r.Status)" }
} elseif ($mode -eq 'forget') {
  $d = Await ($DI::CreateFromIdAsync($env:KALLI_BT_ID)) ($DI)
  $r = Await ($d.Pairing.UnpairAsync()) ([Windows.Devices.Enumeration.DeviceUnpairingResult])
  $out = @{ status = "$($r.Status)" }
}
ConvertTo-Json -Compress -Depth 3 -InputObject @($out)
`

const ENCODED = Buffer.from(SCRIPT, 'utf16le').toString('base64')

type Row = BtDevice & { address: string; pad: boolean }

function run<T>(mode: 'paired' | 'scan' | 'pair' | 'forget', id?: string, timeout = 20_000): Promise<T[]> {
  return new Promise((resolve, reject) =>
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', ENCODED],
      { env: { ...process.env, KALLI_BT_MODE: mode, KALLI_BT_ID: id ?? '' }, timeout, windowsHide: true, maxBuffer: 1 << 20 },
      (err, stdout) => {
        if (err) return reject(new Error('O Bluetooth deste computador não respondeu. Veja se ele está ligado.'))
        try {
          const parsed = JSON.parse(stdout.trim() || '[]')
          resolve((Array.isArray(parsed) ? parsed : [parsed]).filter(Boolean))
        } catch {
          reject(new Error('Resposta estranha do Bluetooth.'))
        }
      }
    )
  )
}

// Names controllers announce themselves with, for the ones whose device class doesn't say "gamepad".
const PAD_NAME = /controller|gamepad|xbox|dualsense|dualshock|joy-?con|8bitdo|joystick|controle/i

/** A computer with two Bluetooth adapters lists each device once per adapter: keep one, the connected one first. */
function controllers(rows: Row[]): BtDevice[] {
  const by = new Map<string, Row>()
  for (const r of rows) {
    if (!r.pad && !PAD_NAME.test(r.name)) continue
    const cur = by.get(r.address || r.id)
    if (!cur || (r.connected && !cur.connected)) by.set(r.address || r.id, r)
  }
  return [...by.values()].map(({ id, name, connected }) => ({ id, name, connected }))
}

// Pair and forget only accept ids this module listed itself.
const known = new Map<string, string>()
const remember = (list: BtDevice[]) => (list.forEach((d) => known.set(d.id, d.name)), list)

/** Controllers paired with this computer, on or off. Fast (Windows' device cache). */
export const paired = async () => (supported ? remember(controllers(await run<Row>('paired'))) : [])

/** Controllers in pairing mode nearby. Bluetooth searches for about 30 seconds. */
export const scan = async () => (supported ? remember(controllers(await run<Row>('scan', undefined, 60_000))) : [])

/** Pairs a controller found by `scan`; resolves with its name. */
export async function pair(id: string) {
  if (!known.has(id)) throw new Error('Controle desconhecido: procure de novo.')
  const [r] = await run<{ status: string }>('pair', id, 60_000)
  if (r?.status !== 'Paired' && r?.status !== 'AlreadyPaired') throw new Error(`Não pareou (${r?.status ?? 'sem resposta'}). Segure o botão de parear e tente de novo.`)
  return known.get(id)!
}

export async function forget(id: string) {
  if (!known.has(id)) throw new Error('Controle desconhecido.')
  await run('forget', id)
}

/**
 * An OS-level popup for when you're not looking at VS Code (browser, Slack, a
 * meeting...). It sits on top of whatever app is open and has the same three
 * answers as the in-editor buddy. No `vscode` dependency.
 *
 *   Windows  small always-on-top window (PowerShell + WinForms) with the buddy's
 *            picture. It never takes keyboard focus, so typing elsewhere can't
 *            answer it by accident.
 *   macOS    osascript dialog
 *   Linux    zenity dialog, or a plain notify-send notification as a fallback
 */
import * as cp from 'child_process';

export type PopupResult = 'drank' | 'snooze' | 'dismiss';

export interface PopupOptions {
  title: string;
  /** Buddy name, shown in the header. */
  name: string;
  line: string;
  /** Today's count and goal, for the progress bar. */
  count: number;
  goal: number;
  /** e.g. "Today: 5 / 8 water breaks" */
  progress: string;
  snoozeLabel: string;
  /** PNG of the buddy (Windows only). */
  imagePath?: string;
  /** Used to show "next sip at …" after answering (Windows only). */
  intervalMinutes: number;
}

export interface PopupCommand {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface DesktopPopupHandle {
  /** Resolves with the answer, or null if closed without one (e.g. close()). */
  result: Promise<PopupResult | null>;
  close(): void;
}

const DRANK = 'I Drank Water';
const DISMISS = 'Dismiss';

/** WinForms popup. Values come in through HB_* environment variables, so nothing needs escaping. */
export const WINDOWS_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -WarningAction SilentlyContinue -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public static class HydrateBuddyNative {
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

  // Render at the screen's real resolution instead of being stretched (blurry) by Windows.
  public static void UseSharpScaling() {
    try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) { return; } } catch { }
    try { SetProcessDPIAware(); } catch { }
  }

  // Rounded corners on Windows 11 (ignored on older versions).
  public static void RoundCorners(IntPtr hwnd) {
    try { int round = 2; DwmSetWindowAttribute(hwnd, 33, ref round, 4); } catch { }
  }
}

public class HydrateBuddyForm : Form {
  protected override bool ShowWithoutActivation { get { return true; } }
  protected override CreateParams CreateParams {
    get {
      CreateParams cp = base.CreateParams;
      cp.ExStyle |= 0x08000000 | 0x00000008; // WS_EX_NOACTIVATE | WS_EX_TOPMOST: never steals keyboard focus
      cp.ClassStyle |= 0x00020000;           // CS_DROPSHADOW
      return cp;
    }
  }
}
'@
[HydrateBuddyNative]::UseSharpScaling()
[System.Windows.Forms.Application]::EnableVisualStyles()

function Rgb($r, $g, $b) { return [System.Drawing.Color]::FromArgb($r, $g, $b) }
$bg = Rgb 32 32 32
$fg = Rgb 240 240 240
$muted = Rgb 150 150 150
$accent = Rgb 47 140 240
$accentHover = Rgb 74 158 245
$secondary = Rgb 52 52 52
$secondaryHover = Rgb 66 66 66
$track = Rgb 58 58 58

$f = New-Object HydrateBuddyForm
$f.AutoScaleMode = 'None'
$f.FormBorderStyle = 'None'
$f.ShowInTaskbar = $false
$f.TopMost = $true
$f.StartPosition = 'Manual'
$f.BackColor = $bg
$f.ForeColor = $fg
$f.Text = 'Hydrate Buddy'

# All layout is in 96-dpi units, scaled to this screen. Fonts (points) scale on their own.
$g = $f.CreateGraphics()
$s = $g.DpiX / 96.0
$g.Dispose()
function Px($v) { return [int][Math]::Round($v * $s) }
function Pt($x, $y) { return New-Object System.Drawing.Point((Px $x), (Px $y)) }
function Sz($w, $h) { return New-Object System.Drawing.Size((Px $w), (Px $h)) }

$W = 420
$H = 204
$f.ClientSize = Sz $W $H
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$baseLeft = $wa.Right - $f.Width - (Px 16)
$f.Location = New-Object System.Drawing.Point($baseLeft, ($wa.Bottom - $f.Height - (Px 16)))

# Thin accent line along the top, and a hairline border.
$topLine = New-Object System.Windows.Forms.Panel
$topLine.BackColor = $accent
$topLine.Location = Pt 0 0
$topLine.Size = Sz $W 3
$f.Controls.Add($topLine)
$f.Add_Paint({
  param($sender, $e)
  $pen = New-Object System.Drawing.Pen((Rgb 64 64 64), 1)
  $e.Graphics.DrawRectangle($pen, 0, 0, $f.ClientSize.Width - 1, $f.ClientSize.Height - 1)
  $pen.Dispose()
})

$pic = New-Object System.Windows.Forms.PictureBox
$pic.SizeMode = 'Zoom'
$pic.Location = Pt 18 22
$pic.Size = Sz 104 122
if ($env:HB_IMAGE -and (Test-Path -LiteralPath $env:HB_IMAGE)) { $pic.Image = [System.Drawing.Image]::FromFile($env:HB_IMAGE) }
$f.Controls.Add($pic)

function New-Text($text, $x, $y, $w, $h, $font, $size, $style, $color) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Location = Pt $x $y
  $l.Size = Sz $w $h
  $l.Font = New-Object System.Drawing.Font($font, $size, $style)
  $l.ForeColor = $color
  $l.BackColor = [System.Drawing.Color]::Transparent
  $l.UseMnemonic = $false
  $f.Controls.Add($l)
  return $l
}
$regular = [System.Drawing.FontStyle]::Regular
$bold = [System.Drawing.FontStyle]::Bold
$header = New-Text ('HYDRATE BUDDY  ' + [char]0x00B7 + '  ' + $env:HB_NAME.ToUpper()) 136 16 240 18 'Segoe UI' 7.5 $bold $muted
$title = New-Text $env:HB_TITLE 134 34 270 30 'Segoe UI Semibold' 15 $regular $fg
$msg = New-Text $env:HB_LINE 136 68 268 40 'Segoe UI' 9.75 $regular (Rgb 215 215 215)
$prog = New-Text $env:HB_PROGRESS 136 112 268 16 'Segoe UI' 8.25 $regular $muted

# Today's progress bar.
$count = [int]$env:HB_COUNT
$goal = [Math]::Max(1, [int]$env:HB_GOAL)
$barBack = New-Object System.Windows.Forms.Panel
$barBack.BackColor = $track
$barBack.Location = Pt 136 131
$barBack.Size = Sz 268 5
$barFill = New-Object System.Windows.Forms.Panel
$barFill.BackColor = $accent
$barFill.Location = New-Object System.Drawing.Point(0, 0)
$barFill.Size = New-Object System.Drawing.Size([int]($barBack.Width * [Math]::Min(1.0, $count / $goal)), $barBack.Height)
$barBack.Controls.Add($barFill)
$f.Controls.Add($barBack)

$script:result = 'dismiss'
$script:answered = $false
$buttons = @()
function New-Button($text, $x, $y, $w, $h, $value, $back, $hover, $color, $size) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Location = Pt $x $y
  $b.Size = Sz $w $h
  $b.FlatStyle = 'Flat'
  $b.FlatAppearance.BorderSize = 0
  $b.FlatAppearance.MouseOverBackColor = $hover
  $b.FlatAppearance.MouseDownBackColor = $hover
  $b.BackColor = $back
  $b.ForeColor = $color
  $b.Font = New-Object System.Drawing.Font('Segoe UI', $size)
  $b.Cursor = [System.Windows.Forms.Cursors]::Hand
  $b.TabStop = $false
  $b.UseMnemonic = $false
  $b.Tag = $value
  $b.Add_Click({ param($sender, $e) Complete $sender.Tag })
  $f.Controls.Add($b)
  return $b
}
$buttons += New-Button $env:HB_DRANK 18 156 150 34 'drank' $accent $accentHover ([System.Drawing.Color]::White) 9.75
$buttons += New-Button $env:HB_SNOOZE 176 156 128 34 'snooze' $secondary $secondaryHover $fg 9.75
$buttons += New-Button $env:HB_DISMISS 312 156 92 34 'dismiss' $secondary $secondaryHover $fg 9.75
$close = New-Button ([string][char]0x2715) 386 8 26 24 'dismiss' $bg $secondary $muted 9
$buttons += $close

$closer = New-Object System.Windows.Forms.Timer
$closer.Interval = 1700
$closer.Add_Tick({ $closer.Stop(); $f.Close() })

function Complete($value) {
  if ($script:answered) { return }
  $script:answered = $true
  $script:result = $value
  if ($value -eq 'drank') {
    $next = (Get-Date).AddMinutes([double]$env:HB_INTERVAL).ToString('t')
    $title.Text = 'Logged. Nice work!'
    $msg.Text = 'Next sip at ' + $next + ' in every window.'
    $prog.Text = 'Today: ' + ($count + 1) + ' / ' + $goal + ' water breaks'
    $barFill.Width = [int]($barBack.Width * [Math]::Min(1.0, ($count + 1) / $goal))
    $barFill.BackColor = Rgb 46 160 67
    $topLine.BackColor = Rgb 46 160 67
    foreach ($b in $buttons) { $b.Visible = $false }
    $closer.Start()
  } else {
    $f.Close()
  }
}

# A little shake every few seconds until answered.
$script:tick = 0
$shaker = New-Object System.Windows.Forms.Timer
$shaker.Interval = 40
$shaker.Add_Tick({
  $script:tick++
  $phase = $script:tick % 150
  if ($script:answered) { $f.Left = $baseLeft; return }
  if ($phase -lt 10) { $f.Left = $baseLeft + (Px ((($phase % 2) * 12) - 6)) }
  elseif ($phase -eq 10) { $f.Left = $baseLeft }
})
$f.Add_Shown({
  [HydrateBuddyNative]::RoundCorners($f.Handle)
  [System.Media.SystemSounds]::Asterisk.Play()
  $shaker.Start()
})
$f.Add_FormClosed({ $shaker.Stop() })

[System.Windows.Forms.Application]::Run($f)
[Console]::Out.WriteLine('HB_RESULT=' + $script:result)
`;

const MAC_SCRIPT = `
set theLine to (system attribute "HB_NAME") & ": " & (system attribute "HB_LINE")
set theProgress to system attribute "HB_PROGRESS"
set theTitle to system attribute "HB_TITLE"
set snoozeLabel to system attribute "HB_SNOOZE"
set r to display dialog (theLine & return & return & theProgress) with title theTitle buttons {"${DISMISS}", snoozeLabel, "${DRANK}"} with icon note
return button returned of r
`;

export function buildPopupCommand(platform: NodeJS.Platform, o: PopupOptions): PopupCommand | undefined {
  const env: Record<string, string> = {
    HB_TITLE: o.title,
    HB_NAME: o.name,
    HB_LINE: o.line,
    HB_COUNT: String(o.count),
    HB_GOAL: String(o.goal),
    HB_PROGRESS: o.progress,
    HB_SNOOZE: o.snoozeLabel,
    HB_DRANK: DRANK,
    HB_DISMISS: DISMISS,
    HB_INTERVAL: String(o.intervalMinutes),
    HB_IMAGE: o.imagePath ?? '',
  };
  if (platform === 'win32') {
    const encoded = Buffer.from(WINDOWS_SCRIPT, 'utf16le').toString('base64');
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      env,
    };
  }
  if (platform === 'darwin') {
    return { command: 'osascript', args: ['-e', MAC_SCRIPT], env };
  }
  if (platform === 'linux') {
    return {
      command: 'zenity',
      args: [
        '--question',
        `--title=${o.title}`,
        `--text=${o.name}: ${o.line}\n\n${o.progress}`,
        `--ok-label=${DRANK}`,
        `--cancel-label=${DISMISS}`,
        `--extra-button=${o.snoozeLabel}`,
        '--icon-name=dialog-information',
        '--no-wrap',
      ],
      env,
    };
  }
  return undefined;
}

/** Turn the helper process's output into an answer. */
export function parsePopupOutput(
  platform: NodeJS.Platform,
  stdout: string,
  exitCode: number | null,
  snoozeLabel: string,
): PopupResult | null {
  const out = stdout.trim();
  if (platform === 'win32') {
    const m = /HB_RESULT=(drank|snooze|dismiss)/.exec(out);
    return m ? (m[1] as PopupResult) : null;
  }
  if (platform === 'darwin') {
    if (out === DRANK) return 'drank';
    if (out === snoozeLabel) return 'snooze';
    if (out === DISMISS) return 'dismiss';
    return null;
  }
  // zenity: 0 = OK button; 1 = Cancel, or the extra button (its label is printed)
  if (exitCode === 0) return 'drank';
  if (exitCode === 1) return out === snoozeLabel ? 'snooze' : 'dismiss';
  return null;
}

export function showDesktopPopup(
  o: PopupOptions,
  platform: NodeJS.Platform = process.platform,
  spawn: typeof cp.spawn = cp.spawn,
): DesktopPopupHandle | undefined {
  const cmd = buildPopupCommand(platform, o);
  if (!cmd) {
    return undefined;
  }
  let child: cp.ChildProcess;
  try {
    child = spawn(cmd.command, cmd.args, { env: { ...process.env, ...cmd.env }, windowsHide: false });
  } catch {
    return undefined;
  }
  let closedByUs = false;
  let stdout = '';
  child.stdout?.on('data', (d: Buffer) => (stdout += d.toString()));

  const result = new Promise<PopupResult | null>((resolve) => {
    child.on('error', () => {
      // zenity missing on Linux: fall back to a plain notification (no buttons).
      if (platform === 'linux') {
        try {
          cp.spawn('notify-send', ['-a', 'Hydrate Buddy', o.title, `${o.name}: ${o.line}`], { stdio: 'ignore' }).on('error', () => undefined);
        } catch {
          // nothing else to try
        }
      }
      resolve(null);
    });
    child.on('close', (code) => resolve(closedByUs ? null : parsePopupOutput(platform, stdout, code, o.snoozeLabel)));
  });

  return {
    result,
    close: () => {
      closedByUs = true;
      if (child.exitCode === null) {
        child.kill();
      }
    },
  };
}

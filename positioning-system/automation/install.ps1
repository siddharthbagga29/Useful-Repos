<#
  Positioning OS - Windows installer.  Idempotent; safe to re-run.

  The Mac half of this system is launchd, which does not exist on Windows.
  Everything above it - the Python, Playwright, the sheet endpoint - is
  unchanged. Only the scheduler is rewritten here.

  One real improvement over the Mac: Task Scheduler's StartWhenAvailable runs a
  job that was missed because the machine was off or asleep. launchd only
  catches up from sleep, so a MacBook shut at 07:15 loses the day outright.
  On this laptop a missed run happens at the next boot instead.

  Run from an ordinary PowerShell window (no admin needed):
      cd $HOME\positioning-os\positioning-system\automation
      powershell -ExecutionPolicy Bypass -File .\install.ps1
#>

$ErrorActionPreference = 'Stop'

$Auto = Split-Path -Parent $MyInvocation.MyCommand.Path
$Repo = Split-Path -Parent (Split-Path -Parent $Auto)
$Base = Join-Path $HOME '.positioning-os'
$Venv = Join-Path $Base 'venv'
$Logs = Join-Path $Base 'logs'

Write-Host "repo: $Repo"
New-Item -ItemType Directory -Force -Path $Logs, (Join-Path $Base 'state') | Out-Null

# ---- python ---------------------------------------------------------------
# 'python3' is not a Windows command. The py launcher is the reliable one; fall
# back to python.exe. A Microsoft Store stub resolves but cannot create a venv,
# so the version call below is what actually proves we have a real interpreter.
$PyExe = $null
foreach ($c in @('py', 'python')) {
    $cmd = Get-Command $c -ErrorAction SilentlyContinue
    if ($cmd) {
        try {
            $v = & $cmd.Source '-c' 'import sys;print(sys.version_info[0:2])' 2>$null
            if ($LASTEXITCODE -eq 0 -and $v) { $PyExe = $cmd.Source; break }
        } catch { }
    }
}
if (-not $PyExe) {
    throw "No working Python found. Install it from python.org (tick 'Add python.exe to PATH'), then re-run."
}
Write-Host "==> python: $PyExe"

# ---- venv -----------------------------------------------------------------
$VenvPy = Join-Path $Venv 'Scripts\python.exe'
if (-not (Test-Path $VenvPy)) {
    Write-Host '==> creating venv'
    & $PyExe -m venv $Venv
}
& $VenvPy -m pip install --quiet --upgrade pip
& $VenvPy -m pip install --quiet -r (Join-Path $Auto 'requirements.txt')

Write-Host '==> chromium for playwright'
& $VenvPy -m playwright install chromium

# ---- scheduled tasks ------------------------------------------------------
# Output is redirected through cmd.exe because Task Scheduler has no log
# option of its own; without this a failure leaves nothing to read.
function Set-PosTask {
    param([string]$Name, [string]$Script, [string]$Log,
          [Microsoft.Management.Infrastructure.CimInstance]$Trigger)

    $line = '"{0}" "{1}" >> "{2}" 2>&1' -f $VenvPy, (Join-Path $Auto "src\$Script"), (Join-Path $Logs $Log)
    $action = New-ScheduledTaskAction -Execute 'cmd.exe' `
        -Argument ('/c ' + $line) -WorkingDirectory $Repo

    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -WakeToRun `
        -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
        -MultipleInstances IgnoreNew

    Unregister-ScheduledTask -TaskName $Name -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $Trigger `
        -Settings $settings -Description 'Positioning OS' | Out-Null
    Write-Host "    registered $Name"
}

Write-Host '==> scheduled tasks'
Set-PosTask -Name 'PositioningOS Daily'  -Script 'run_daily.py'  -Log 'daily.log' `
    -Trigger (New-ScheduledTaskTrigger -Daily -At '7:15AM')
Set-PosTask -Name 'PositioningOS Weekly' -Script 'run_weekly.py' -Log 'weekly.log' `
    -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At '5:00PM')

# ---- what is left to do ---------------------------------------------------
$Cfg = Join-Path $Auto 'config.json'
Write-Host ''
if (Test-Path $Cfg) {
    Write-Host 'config.json is present.'
} else {
    Write-Host 'REMAINING STEP: create config.json'
    Write-Host "  copy config.example.json config.json   # then fill in:"
    Write-Host '    ingest_url      the Apps Script Web App /exec URL'
    Write-Host '    ingest_token    printed by setupIngestToken in the Execution log'
    Write-Host '    census_api_key  https://api.census.gov/data/key_signup.html'
    Write-Host ''
    Write-Host 'Copy these three from the Mac if it is already set up - they are'
    Write-Host 'the same values, and config.json is git-ignored so it did not'
    Write-Host 'travel with the clone.'
}
Write-Host ''
Write-Host 'Then verify the whole chain:'
Write-Host "  $VenvPy $Auto\src\selftest.py"
Write-Host ''
Write-Host 'Only ONE machine should run the daily job. Two will double every row.'
Write-Host 'If this laptop takes over, disable the Mac:'
Write-Host '  launchctl unload ~/Library/LaunchAgents/com.positioningos.daily.plist'
Write-Host '  launchctl unload ~/Library/LaunchAgents/com.positioningos.weekly.plist'

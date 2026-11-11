# Running Positioning OS on the HP laptop (Windows)

Only the scheduler differs. The Python, Playwright and the sheet endpoint are
identical — the Mac half just ran under launchd, which Windows does not have.

## Install

```powershell
git clone https://github.com/siddharthbagga29/Useful-Repos.git $HOME\positioning-os
cd $HOME\positioning-os\positioning-system\automation
git checkout claude/private-markets-positioning-system-b5twgr
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

`install.ps1` builds the venv, installs Chromium, and registers two tasks:
**PositioningOS Daily** at 07:15 and **PositioningOS Weekly** on Sunday at
17:00. Re-running it is safe.

## config.json does not travel with the clone

It is git-ignored, which is the point — it holds the ingest token and the
Census key. Copy the three values across from the Mac, or re-read them with
`nexusCredentials` in the Apps Script editor:

```powershell
cd $HOME\positioning-os\positioning-system\automation
copy config.example.json config.json
notepad config.json
```

Fill `ingest_url`, `ingest_token`, `census_api_key`. Then:

```powershell
& $HOME\.positioning-os\venv\Scripts\python.exe .\src\selftest.py
```

Every line must read OK before the schedule is worth trusting.

## Only one machine may run the daily job

Two machines means every Census figure, every Form D row and every scrape
result is written twice, and the duplicates look exactly like real data. If
this laptop takes over, turn the Mac off first:

```bash
launchctl unload ~/Library/LaunchAgents/com.positioningos.daily.plist
launchctl unload ~/Library/LaunchAgents/com.positioningos.weekly.plist
```

The Apps Script half runs on Google and is unaffected either way. It already
skips its own Census pull when a Mac or PC has done one that day, so that one
piece is safe — nothing else is.

## Windows is better at this than the Mac was

`StartWhenAvailable` runs a job that was missed because the machine was off or
asleep. launchd only catches up from sleep, so a MacBook shut at 07:15 lost the
day outright. Here the run happens at the next boot.

`WakeToRun` is also set, which asks Windows to wake the machine for the job.
Whether it does depends on the power plan and on the lid being open on some
hardware — treat it as a bonus, not a guarantee. The catch-up is the part worth
relying on.

## Checking it

```powershell
Get-ScheduledTask -TaskName 'PositioningOS*' |
  Get-ScheduledTaskInfo | Select TaskName, LastRunTime, LastTaskResult, NextRunTime

Get-Content $HOME\.positioning-os\logs\daily.log -Tail 40
```

`LastTaskResult` of 0 is success. To force a run now:

```powershell
Start-ScheduledTask -TaskName 'PositioningOS Daily'
```

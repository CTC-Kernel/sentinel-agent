# Install the MSI on a throwaway machine (the CI runner) and check what it
# leaves behind:
#   - %ProgramData%\Sentinel: owner Administrators, inheritance from
#     ProgramData cut, SYSTEM and Administrators the only ones with any right,
#     on the directory and on everything below; the grant to every local user
#     of earlier versions is gone, and a rule file a standard user wrote stays
#     theirs (so the agent refuses it);
#   - the enrollment token: in a registry value only SYSTEM and Administrators
#     may open, not in agent.json, and in the installer's verbose log only
#     where Windows Installer writes that registry value out.
# Must run elevated. Changes the machine: never run it on a real one.

param(
    [Parameter(Mandatory = $true)][string]$Msi
)

$ErrorActionPreference = 'Stop'
$SYSTEM = 'S-1-5-18'
$ADMINISTRATORS = 'S-1-5-32-544'
$USERS = 'S-1-5-32-545'
$data = Join-Path $env:ProgramData 'Sentinel'
$failures = [System.Collections.Generic.List[string]]::new()

function Fail([string]$message) {
    Write-Host "FAIL: $message"
    $failures.Add($message)
}

function Sid($identity) {
    $identity.Translate([System.Security.Principal.SecurityIdentifier]).Value
}

# What earlier versions left: every local user may modify the whole tree, and
# one of them wrote a rule file.
New-Item -ItemType Directory -Force -Path (Join-Path $data 'checks.d'), (Join-Path $data 'data') | Out-Null
$planted = Join-Path $data 'checks.d\planted.toml'
Set-Content -Path $planted -Value '# written while the directory was open to everyone'
icacls $data /grant "*${USERS}:(OI)(CI)(M)" /T /C /Q | Out-Null
icacls $planted /setowner "*$USERS" /C /Q | Out-Null
if ((Get-Acl $planted).GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $USERS) {
    throw 'setup: could not give the planted file to Users'
}

$token = 'ci-token-' + [guid]::NewGuid().ToString('N')
$log = Join-Path $env:RUNNER_TEMP 'msi-install.log'
$arguments = @(
    '/i', "`"$Msi`"", '/qn', '/l*v', "`"$log`"",
    "ENROLLMENTTOKEN=$token", 'SERVERURL=https://127.0.0.1:9'
)
$install = Start-Process -FilePath msiexec.exe -ArgumentList $arguments -Wait -PassThru
# The installer starts the desktop app; it has nothing to do here.
Start-Sleep -Seconds 5
Get-Process -Name 'sentinel-agent' -ErrorAction SilentlyContinue | Stop-Process -Force
if ($install.ExitCode -ne 0) {
    Get-Content $log -Tail 100
    throw "msiexec exited with $($install.ExitCode)"
}
Write-Host "Installed $Msi"

# The data directory.
$rootAcl = Get-Acl $data
if (-not $rootAcl.AreAccessRulesProtected) { Fail "$data still inherits from ProgramData" }
$owner = $rootAcl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
if ($owner -ne $ADMINISTRATORS) { Fail "$data is owned by $owner" }
$entries = @(Get-Item $data -Force) + @(Get-ChildItem $data -Recurse -Force)
foreach ($entry in $entries) {
    foreach ($rule in (Get-Acl -LiteralPath $entry.FullName).Access) {
        $sid = Sid $rule.IdentityReference
        if ($sid -ne $SYSTEM -and $sid -ne $ADMINISTRATORS) {
            Fail "$($entry.FullName): $($rule.IdentityReference) ($sid) has $($rule.FileSystemRights)"
        }
    }
}
Write-Host "$($entries.Count) entries checked under $data"
foreach ($file in 'agent.json', 'data\key.dpapi', 'data\agent.db') {
    $path = Join-Path $data $file
    if (Test-Path $path) {
        $fileOwner = (Get-Acl $path).GetOwner([System.Security.Principal.SecurityIdentifier]).Value
        if ($fileOwner -ne $ADMINISTRATORS -and $fileOwner -ne $SYSTEM) { Fail "$path is owned by $fileOwner" }
    }
}
$plantedOwner = (Get-Acl $planted).GetOwner([System.Security.Principal.SecurityIdentifier]).Value
if ($plantedOwner -ne $USERS) { Fail "the planted rule file is now owned by $plantedOwner" }

# The enrollment token.
$config = Join-Path $data 'agent.json'
if (-not (Test-Path $config)) { Fail 'no agent.json' }
elseif (Select-String -Path $config -SimpleMatch $token -Quiet) { Fail 'the token is in agent.json' }
$key = 'HKLM:\SOFTWARE\Sentinel\Agent\Enrollment'
if (-not (Test-Path $key)) {
    Fail "no $key"
} else {
    if ((Get-ItemProperty $key).Token -ne $token) { Fail "$key does not hold the token" }
    foreach ($rule in (Get-Acl $key).Access) {
        $sid = Sid $rule.IdentityReference
        if ($sid -ne $SYSTEM -and $sid -ne $ADMINISTRATORS) {
            Fail "${key}: $($rule.IdentityReference) ($sid) has $($rule.RegistryRights)"
        }
    }
}
$leaks = @(Select-String -Path $log -SimpleMatch $token)
foreach ($leak in $leaks) {
    $line = $leak.Line.Replace($token, '<token>')
    # A verbose log (/l*v) shows the data of every registry write, hidden
    # property or not: the one place the token is expected.
    if ($line -match 'Executing op: RegAddValue\(Name=Token,Value=<token>,\)') {
        Write-Host "Expected: the verbose log shows the registry write, line $($leak.LineNumber)"
        continue
    }
    Fail "the token is in the installer log, line $($leak.LineNumber): $line"
}
$startup = Join-Path $data 'logs\startup.log'
if ((Test-Path $startup) -and (Select-String -Path $startup -SimpleMatch $token -Quiet)) {
    Fail 'the token is in startup.log'
}

if ($failures.Count -gt 0) {
    Write-Host ''
    Write-Host 'icacls of the data directory:'
    icacls $data /T /C
    throw "$($failures.Count) check(s) failed"
}
Write-Host 'All installation checks passed'

# Diagnostic complet du problème MSI vs Développement
# L'agent fonctionne en développement mais pas après installation MSI

Write-Host "=== DIAGNOSTIC MSI VS DÉVELOPPEMENT ===" -ForegroundColor Cyan

# 1. Comparaison des exécutables
Write-Host "`n1. COMPARAISON DES EXÉCUTABLES" -ForegroundColor Yellow

$msiHash = "73C0055DCA6165DC3A021FEAE7FE20DB823EC1AA62A54BBF1D740875CBE1FC51"
$devHash = "CAD775DFA98BF60DAC069A4FF014FF6E520838D658437F921D0B5C50115CE8F3"

$msiPath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"
$devPath = "c:\dev\AGENT\sentinel-agent\target\release\agent-core.exe"

Write-Host "Exécutable MSI:" -ForegroundColor Gray
Write-Host "  Hash: $msiHash" -ForegroundColor White
Write-Host "  Path: $msiPath" -ForegroundColor Gray

Write-Host "`nExécutable Développement:" -ForegroundColor Gray
Write-Host "  Hash: $devHash" -ForegroundColor White
Write-Host "  Path: $devPath" -ForegroundColor Gray

if ($msiHash -ne $devHash) {
    Write-Host "`n❌ Les exécutables sont DIFFÉRENTS" -ForegroundColor Red
    Write-Host "   Le MSI utilise une version différente de l'exécutable" -ForegroundColor Yellow
} else {
    Write-Host "`n✅ Les exécutables sont identiques" -ForegroundColor Green
}

# 2. Test de l'exécutable de développement
Write-Host "`n2. TEST EXÉCUTABLE DÉVELOPPEMENT" -ForegroundColor Yellow

if (Test-Path $devPath) {
    try {
        $process = Start-Process -FilePath $devPath -ArgumentList "--version" -PassThru -WindowStyle Hidden
        $process.WaitForExit(5000) | Out-Null
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ Exécutable développement fonctionne" -ForegroundColor Green
        } else {
            Write-Host "❌ Exécutable développement échoue (Exit code: $($process.ExitCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur lancement développement: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Exécutable développement non trouvé" -ForegroundColor Red
}

# 3. Test de l'exécutable MSI
Write-Host "`n3. TEST EXÉCUTABLE MSI" -ForegroundColor Yellow

if (Test-Path $msiPath) {
    try {
        $process = Start-Process -FilePath $msiPath -ArgumentList "--version" -PassThru -WindowStyle Hidden
        $process.WaitForExit(5000) | Out-Null
        
        if ($process.ExitCode -eq 0) {
            Write-Host "✅ Exécutable MSI fonctionne" -ForegroundColor Green
        } else {
            Write-Host "❌ Exécutable MSI échoue (Exit code: $($process.ExitCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Erreur lancement MSI: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Exécutable MSI non trouvé" -ForegroundColor Red
}

# 4. Analyse de l'environnement
Write-Host "`n4. ANALYSE ENVIRONNEMENT" -ForegroundColor Yellow

# Variables d'environnement
Write-Host "Variables d'environnement:" -ForegroundColor Gray
$envVars = @("PATH", "RUST_LOG", "SENTINEL_CONFIG", "OPENSSL_DIR")
foreach ($var in $envVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ($value) {
        Write-Host "  $var = $value" -ForegroundColor White
    }
}

# Répertoires de travail
Write-Host "`nRépertoires:" -ForegroundColor Gray
Write-Host "  Current: $(Get-Location)" -ForegroundColor White
Write-Host "  MSI: $(Split-Path $msiPath)" -ForegroundColor White
Write-Host "  Dev: $(Split-Path $devPath)" -ForegroundColor White

# Permissions
Write-Host "`nPermissions:" -ForegroundColor Gray
try {
    $msiAcl = Get-Acl $msiPath
    $devAcl = Get-Acl $devPath
    
    Write-Host "  MSI: Owner = $($msiAcl.Owner)" -ForegroundColor White
    Write-Host "  Dev: Owner = $($devAcl.Owner)" -ForegroundColor White
} catch {
    Write-Host "  Erreur lecture ACL: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test avec arguments différents
Write-Host "`n5. TEST AVEC ARGUMENTS DIFFÉRENTS" -ForegroundColor Yellow

$arguments = @("--help", "--version", "status")

foreach ($arg in $arguments) {
    Write-Host "Test MSI avec argument: $arg" -ForegroundColor Gray
    
    try {
        $process = Start-Process -FilePath $msiPath -ArgumentList $arg -PassThru -WindowStyle Hidden
        $process.WaitForExit(3000) | Out-Null
        
        if ($process.ExitCode -eq 0) {
            Write-Host "  ✅ Succès" -ForegroundColor Green
        } else {
            Write-Host "  ❌ Échec (Exit code: $($process.ExitCode))" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 6. Diagnostic des dépendances
Write-Host "`n6. DIAGNOSTIC DÉPENDANCES" -ForegroundColor Yellow

# Vérifier les DLL manquantes
Write-Host "Vérification des dépendances..." -ForegroundColor Gray

try {
    # Utiliser dumpbin si disponible, ou autre méthode
    $result = & "C:\Program Files (x86)\Microsoft Visual Studio\2019\Enterprise\VC\Tools\MSVC\*\bin\Hostx64\x64\dumpbin.exe" "/dependents" $msiPath 2>$null
    if ($result) {
        Write-Host "Dépendances trouvées:" -ForegroundColor White
        $result | Where-Object { $_ -match ".dll" } | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
    } else {
        Write-Host "dumpbin non disponible, utilisation d'une autre méthode..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Impossible d'analyser les dépendances avec dumpbin" -ForegroundColor Yellow
}

# 7. Solutions proposées
Write-Host "`n7. SOLUTIONS PROPOSÉES" -ForegroundColor Yellow

Write-Host "Option 1: Copier l'exécutable de développement" -ForegroundColor Cyan
Write-Host "  Copy-Item `"$devPath`" `"$msiPath`" -Force" -ForegroundColor Gray

Write-Host "`nOption 2: Reconstruire le MSI avec le bon exécutable" -ForegroundColor Cyan
Write-Host "  - Vérifier que le MSI utilise le bon binaire" -ForegroundColor Gray
Write-Host "  - Reconstruire avec les dernières corrections" -ForegroundColor Gray

Write-Host "`nOption 3: Analyser les différences de build" -ForegroundColor Cyan
Write-Host "  - Comparer les options de compilation" -ForegroundColor Gray
Write-Host "  - Vérifier les dépendances statiques vs dynamiques" -ForegroundColor Gray

Write-Host "`n=== DIAGNOSTIC TERMINÉ ===" -ForegroundColor Cyan

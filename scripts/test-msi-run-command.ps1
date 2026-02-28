# Test spécifique de la commande run sur MSI vs Développement
Write-Host "=== TEST COMMANDE RUN MSI VS DEV ===" -ForegroundColor Cyan

$msiPath = "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe"
$devPath = "c:\dev\AGENT\sentinel-agent\target\release\agent-core.exe"

# Test run avec développement
Write-Host "`n1. TEST RUN - DÉVELOPPEMENT" -ForegroundColor Yellow

try {
    Write-Host "Lancement: $devPath run" -ForegroundColor Gray
    
    $process = Start-Process -FilePath $devPath -ArgumentList "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 3
    
    if ($process.HasExited) {
        Write-Host "❌ Développement run échoué (Exit code: $($process.ExitCode))" -ForegroundColor Red
    } else {
        Write-Host "✅ Développement run réussi (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "❌ Erreur développement run: $($_.Exception.Message)" -ForegroundColor Red
}

# Test run avec MSI
Write-Host "`n2. TEST RUN - MSI" -ForegroundColor Yellow

try {
    Write-Host "Lancement: $msiPath run" -ForegroundColor Gray
    
    $process = Start-Process -FilePath $msiPath -ArgumentList "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 3
    
    if ($process.HasExited) {
        Write-Host "❌ MSI run échoué (Exit code: $($process.ExitCode))" -ForegroundColor Red
        
        # Analyser l'exit code
        switch ($process.ExitCode) {
            1 { Write-Host "   Erreur de configuration" -ForegroundColor Yellow }
            2 { Write-Host "   Erreur de dépendances" -ForegroundColor Yellow }
            3 { Write-Host "   Erreur de permissions" -ForegroundColor Yellow }
            default { Write-Host "   Erreur inconnue" -ForegroundColor Yellow }
        }
    } else {
        Write-Host "✅ MSI run réussi (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "❌ Erreur MSI run: $($_.Exception.Message)" -ForegroundColor Red
}

# Test run avec debug
Write-Host "`n3. TEST RUN DEBUG - MSI" -ForegroundColor Yellow

try {
    Write-Host "Lancement: $msiPath --log-level debug run" -ForegroundColor Gray
    
    $process = Start-Process -FilePath $msiPath -ArgumentList "--log-level debug", "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 3
    
    if ($process.HasExited) {
        Write-Host "❌ MSI debug run échoué (Exit code: $($process.ExitCode))" -ForegroundColor Red
    } else {
        Write-Host "✅ MSI debug run réussi (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host "❌ Erreur MSI debug run: $($_.Exception.Message)" -ForegroundColor Red
}

# Test run avec config explicite
Write-Host "`n4. TEST RUN CONFIG EXPLICITE - MSI" -ForegroundColor Yellow

$configPath = "C:\ProgramData\Sentinel\agent.json"
if (Test-Path $configPath) {
    try {
        Write-Host "Lancement: $msiPath -c `"$configPath`" run" -ForegroundColor Gray
        
        $process = Start-Process -FilePath $msiPath -ArgumentList "-c", "`"$configPath`"", "run" -PassThru -WindowStyle Normal
        Start-Sleep -Seconds 3
        
        if ($process.HasExited) {
            Write-Host "❌ MSI config run échoué (Exit code: $($process.ExitCode))" -ForegroundColor Red
        } else {
            Write-Host "✅ MSI config run réussi (PID: $($process.Id))" -ForegroundColor Green
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-Host "❌ Erreur MSI config run: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ Fichier de configuration non trouvé" -ForegroundColor Yellow
}

# Solution rapide
Write-Host "`n5. SOLUTION RAPIDE" -ForegroundColor Yellow

Write-Host "Copie de l'exécutable de développement vers MSI..." -ForegroundColor Gray

try {
    # Backup de l'original
    $backupPath = "$msiPath.backup"
    if (Test-Path $msiPath) {
        Copy-Item $msiPath $backupPath -Force
        Write-Host "✅ Backup créé: $backupPath" -ForegroundColor Green
    }
    
    # Copie de la version de développement
    Copy-Item $devPath $msiPath -Force
    Write-Host "✅ Exécutable de développement copié vers MSI" -ForegroundColor Green
    
    # Test du nouveau lancement
    Write-Host "`nTest du lancement avec exécutable de développement..." -ForegroundColor Gray
    
    $process = Start-Process -FilePath $msiPath -ArgumentList "run" -PassThru -WindowStyle Normal
    Start-Sleep -Seconds 3
    
    if ($process.HasExited) {
        Write-Host "❌ Échec même avec exécutable de développement (Exit code: $($process.ExitCode))" -ForegroundColor Red
    } else {
        Write-Host "✅ Succès avec exécutable de développement (PID: $($process.Id))" -ForegroundColor Green
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    
} catch {
    Write-Host "❌ Erreur copie: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== TEST TERMINÉ ===" -ForegroundColor Cyan

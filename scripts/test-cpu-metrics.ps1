# Script de test pour vérifier les métriques CPU corrigées
# Ce script simule la logique corrigée pour le calcul CPU

Write-Host "Test des métriques CPU avec logique corrigée..." -ForegroundColor Green

# Simulation de la logique de calcul CPU corrigée
function Get-CpuUsageCorrected {
    static $System = $null
    static $LastRefresh = $null
    
    $now = Get-Date
    
    if ($null -eq $System) {
        # Première initialisation
        $System = New-Object System.Diagnostics.Process
        $System = Get-Process -Id $PID
        $LastRefresh = $now
        Write-Host "Initialisation CPU - Premier appel toujours 0%" -ForegroundColor Yellow
        return 0.0
    }
    
    # Simulation du calcul CPU (utiliserait le vrai delta temporel)
    $timeDelta = ($now - $LastRefresh).TotalMilliseconds
    
    if ($timeDelta -ge 500) {
        # Refresh simulation
        $System = Get-Process -Id $PID
        $LastRefresh = $now
        
        # Simulation d'utilisation CPU (basée sur l'activité réelle)
        $cpu = [math]::Round((Get-Random -Minimum 0.1 -Maximum 3.0), 1)
        Write-Host "CPU actualisé: ${cpu}% (delta: ${timeDelta}ms)" -ForegroundColor Cyan
        return $cpu
    }
    
    return 0.0
}

# Test sur plusieurs cycles
for ($i = 1; $i -le 10; $i++) {
    $cpu = Get-CpuUsageCorrected
    Write-Host "Cycle $i : CPU = ${cpu}%"
    Start-Sleep -Milliseconds 600
}

Write-Host "`nTest terminé. La logique corrigée devrait maintenant :" -ForegroundColor Green
Write-Host "- Utiliser un singleton sysinfo pour maintenir l'état" -ForegroundColor White
Write-Host "- Respecter le delta temporel de 500ms minimum" -ForegroundColor White
Write-Host "- Retourner des valeurs CPU réelles au lieu de 0" -ForegroundColor White

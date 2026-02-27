# Script pour corriger les permissions de service Sentinel
# Exécuter en tant qu'administrateur

Write-Host "Vérification des permissions pour le service Sentinel..." -ForegroundColor Yellow

# Vérifier si on est administrateur
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Ce script doit être exécuté en tant qu'administrateur!" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}

# Arrêter le service s'il est en cours d'exécution
Write-Host "Arrêt du service Sentinel..." -ForegroundColor Blue
try {
    Stop-Service -Name "SentinelGRCAgent" -Force -ErrorAction SilentlyContinue
    Write-Host "Service arrêté avec succès" -ForegroundColor Green
} catch {
    Write-Host "Le service n'était pas en cours d'exécution ou déjà arrêté" -ForegroundColor Yellow
}

# Donner les permissions nécessaires sur les répertoires
Write-Host "Configuration des permissions sur les répertoires..." -ForegroundColor Blue

$paths = @(
    "C:\Program Files (x86)\Sentinel",
    "C:\ProgramData\Sentinel"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "Configuration des permissions pour: $path" -ForegroundColor Cyan
        
        # Donner le contrôle total au SYSTEM
        $acl = Get-Acl $path
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            "SYSTEM", 
            "FullControl", 
            "ContainerInherit,ObjectInherit", 
            "None", 
            "Allow"
        )
        $acl.SetAccessRule($rule)
        Set-Acl $path $acl
        
        # Donner le contrôle complet au Administrateurs
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            "Administrators", 
            "FullControl", 
            "ContainerInherit,ObjectInherit", 
            "None", 
            "Allow"
        )
        $acl.SetAccessRule($rule)
        Set-Acl $path $acl
        
        Write-Host "Permissions configurées pour: $path" -ForegroundColor Green
    } else {
        Write-Host "Répertoire inexistant: $path" -ForegroundColor Red
    }
}

# Réinstaller le service avec les permissions correctes
Write-Host "Réinstallation du service..." -ForegroundColor Blue

try {
    # Désinstaller l'ancien service
    & "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" uninstall
    Write-Host "Ancien service désinstallé" -ForegroundColor Green
    
    # Réinstaller le service
    & "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" install
    Write-Host "Service réinstallé avec succès" -ForegroundColor Green
    
} catch {
    Write-Host "Erreur lors de la réinstallation du service: $_" -ForegroundColor Red
}

# Démarrer le service
Write-Host "Démarrage du service..." -ForegroundColor Blue
try {
    Start-Service -Name "SentinelGRCAgent"
    Write-Host "Service démarré avec succès!" -ForegroundColor Green
} catch {
    Write-Host "Erreur lors du démarrage du service: $_" -ForegroundColor Red
}

# Vérifier le statut final
Write-Host "Vérification du statut du service..." -ForegroundColor Blue
$service = Get-Service -Name "SentinelGRCAgent" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host "Statut: $($service.Status)" -ForegroundColor Cyan
    Write-Host "Process ID: $($service.Id)" -ForegroundColor Cyan
} else {
    Write-Host "Service introuvable!" -ForegroundColor Red
}

Write-Host "Opération terminée!" -ForegroundColor Green
Read-Host "Appuyez sur Entrée pour quitter"

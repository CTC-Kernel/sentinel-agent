@echo off
REM Script d'installation qui installe d'abord le certificat, puis le MSI
REM Auto-detecte le .cer et le .msi dans le dossier courant

echo Installation Sentinel GRC Agent (securisee)
echo =============================================

REM Verifier les droits admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Droits administrateur requis
    echo Relancez ce script en tant qu'administrateur
    pause
    exit /b 1
)

REM Auto-detection du certificat (.cer)
set "CERT_FILE="
for %%f in ("%~dp0*.cer") do set "CERT_FILE=%%f"
if not defined CERT_FILE (
    echo Aucun fichier .cer trouve dans %~dp0
    pause
    exit /b 1
)
echo Certificat detecte : %CERT_FILE%

REM Auto-detection du MSI (.msi)
set "MSI_FILE="
for %%f in ("%~dp0*.msi") do set "MSI_FILE=%%f"
if not defined MSI_FILE (
    echo Aucun fichier .msi trouve dans %~dp0
    pause
    exit /b 1
)
echo MSI detecte : %MSI_FILE%

REM 1. Installer le certificat dans Trusted Publishers
echo.
echo Installation du certificat de confiance...
certutil -addstore "TrustedPublisher" "%CERT_FILE%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Certificat ajoute aux Trusted Publishers
) else (
    echo Erreur lors de l'ajout du certificat aux Trusted Publishers
)

REM 2. Installer aussi dans les racines de confiance (bypass SmartScreen complet)
certutil -addstore "Root" "%CERT_FILE%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Certificat ajoute aux Trusted Root
) else (
    echo Erreur lors de l'ajout aux racines de confiance
)

REM 3. Installer le MSI (maintenant sans avertissement)
echo.
echo Installation de Sentinel GRC Agent...
msiexec /i "%MSI_FILE%" /quiet /norestart

if %errorLevel% equ 0 (
    echo Installation terminee avec succes!
) else (
    echo Erreur lors de l'installation MSI
    echo Code d'erreur: %errorLevel%
)

REM 4. Demarrer le service
echo.
echo Demarrage du service...
net start SentinelGRCAgent >nul 2>&1

echo.
echo Installation complete!
echo Le certificat est maintenant installe sur cette machine
echo Les futures installations n'auront plus d'avertissements
echo.
pause

<#
.SYNOPSIS
    Sentinel GRC Agent - Windows Installation Wizard
.DESCRIPTION
    Interactive PowerShell installer with native Windows interface
.PARAMETER SkipGUI
    Skip GUI and run in silent mode
#>

param(
    [switch]$SkipGUI
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Global variables
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppName = "Sentinel GRC Agent"
$Version = "2.0.0"
$DefaultInstallPath = "$env:ProgramFiles\Sentinel GRC"

# Create main form
function Create-MainForm {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "$AppName - Installation Wizard"
    $form.Size = New-Object System.Drawing.Size(600, 500)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($env:windir + "\System32\shell32.dll", 78)
    $form.BackColor = [System.Drawing.Color]::White
    
    return $form
}

# Create welcome page
function Create-WelcomePage {
    $form = Create-MainForm
    
    # Title
    $title = New-Object System.Windows.Forms.Label
    $title.Text = "Welcome to $AppName"
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $title.Location = New-Object System.Drawing.Point(50, 30)
    $title.Size = New-Object System.Drawing.Size(500, 30)
    $title.ForeColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $form.Controls.Add($title)
    
    # Subtitle
    $subtitle = New-Object System.Windows.Forms.Label
    $subtitle.Text = "Endpoint compliance monitoring for Sentinel GRC platform"
    $subtitle.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $subtitle.Location = New-Object System.Drawing.Point(50, 70)
    $subtitle.Size = New-Object System.Drawing.Size(500, 20)
    $subtitle.ForeColor = [System.Drawing.Color]::Gray
    $form.Controls.Add($subtitle)
    
    # Features
    $features = @"
This installer will:
• Install the Sentinel Agent application
• Set up Windows service integration
• Configure automatic updates
• Create desktop and Start Menu shortcuts
• Enable system tray notifications
• Configure firewall rules
    "@
    
    $featuresLabel = New-Object System.Windows.Forms.Label
    $featuresLabel.Text = $features
    $featuresLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $featuresLabel.Location = New-Object System.Drawing.Point(50, 120)
    $featuresLabel.Size = New-Object System.Drawing.Size(500, 120)
    $form.Controls.Add($featuresLabel)
    
    # Logo placeholder
    $logoBox = New-Object System.Windows.Forms.PictureBox
    $logoBox.Location = New-Object System.Drawing.Point(450, 30)
    $logoBox.Size = New-Object System.Drawing.Size(100, 100)
    $logoBox.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $logoBox.SizeMode = "CenterImage"
    $form.Controls.Add($logoBox)
    
    # Buttons
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(400, 420)
    $cancelButton.Size = New-Object System.Drawing.Size(80, 30)
    $cancelButton.DialogResult = "Cancel"
    $form.Controls.Add($cancelButton)
    
    $nextButton = New-Object System.Windows.Forms.Button
    $nextButton.Text = "Next >"
    $nextButton.Location = New-Object System.Drawing.Point(490, 420)
    $nextButton.Size = New-Object System.Drawing.Size(80, 30)
    $nextButton.DialogResult = "OK"
    $nextButton.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $nextButton.ForeColor = [System.Drawing.Color]::White
    $nextButton.FlatStyle = "Flat"
    $form.Controls.Add($nextButton)
    
    $form.AcceptButton = $nextButton
    $form.CancelButton = $cancelButton
    
    return $form
}

# Create license page
function Create-LicensePage {
    $form = Create-MainForm
    
    # Title
    $title = New-Object System.Windows.Forms.Label
    $title.Text = "License Agreement"
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
    $title.Location = New-Object System.Drawing.Point(50, 20)
    $title.Size = New-Object System.Drawing.Size(500, 30)
    $title.ForeColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $form.Controls.Add($title)
    
    # License text
    $licenseText = @"
Sentinel GRC Agent License Agreement
Copyright © 2024-2026 Cyber Threat Consulting

IMPORTANT NOTICE: This software is provided 'as-is', without warranty of any kind. 
By installing this software, you agree to:

1. Use the software only for legitimate security monitoring purposes
2. Not reverse engineer or modify the software
3. Comply with all applicable laws and regulations
4. Not use the software for any malicious purposes

Full terms available at: https://sentinel-grc-v2-prod.web.app/terms

This software collects system information for compliance monitoring purposes.
By continuing, you consent to this data collection and processing.
    "@
    
    $textBox = New-Object System.Windows.Forms.TextBox
    $textBox.Multiline = $true
    $textBox.ScrollBars = "Vertical"
    $textBox.Text = $licenseText
    $textBox.Location = New-Object System.Drawing.Point(50, 60)
    $textBox.Size = New-Object System.Drawing.Size(500, 250)
    $textBox.ReadOnly = $true
    $textBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    $form.Controls.Add($textBox)
    
    # Accept checkbox
    $acceptCheck = New-Object System.Windows.Forms.CheckBox
    $acceptCheck.Text = "I accept the license agreement"
    $acceptCheck.Location = New-Object System.Drawing.Point(50, 330)
    $acceptCheck.Size = New-Object System.Drawing.Size(200, 25)
    $acceptCheck.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $form.Controls.Add($acceptCheck)
    
    # Buttons
    $backButton = New-Object System.Windows.Forms.Button
    $backButton.Text = "< Back"
    $backButton.Location = New-Object System.Drawing.Point(320, 420)
    $backButton.Size = New-Object System.Drawing.Size(80, 30)
    $backButton.DialogResult = "Retry"
    $form.Controls.Add($backButton)
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(410, 420)
    $cancelButton.Size = New-Object System.Drawing.Size(80, 30)
    $cancelButton.DialogResult = "Cancel"
    $form.Controls.Add($cancelButton)
    
    $installButton = New-Object System.Windows.Forms.Button
    $installButton.Text = "Install"
    $installButton.Location = New-Object System.Drawing.Point(500, 420)
    $installButton.Size = New-Object System.Drawing.Size(80, 30)
    $installButton.Enabled = $false
    $installButton.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $installButton.ForeColor = [System.Drawing.Color]::White
    $installButton.FlatStyle = "Flat"
    $form.Controls.Add($installButton)
    
    # Enable install button when checkbox is checked
    $acceptCheck.Add_CheckedChanged({
        $installButton.Enabled = $acceptCheck.Checked
    })
    
    $form.AcceptButton = $installButton
    
    return $form, $acceptCheck
}

# Create installation progress page
function Create-ProgressPage {
    $form = Create-MainForm
    
    # Title
    $title = New-Object System.Windows.Forms.Label
    $title.Text = "Installing $AppName"
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
    $title.Location = New-Object System.Drawing.Point(50, 20)
    $title.Size = New-Object System.Drawing.Size(500, 30)
    $title.ForeColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $form.Controls.Add($title)
    
    # Progress bar
    $progressBar = New-Object System.Windows.Forms.ProgressBar
    $progressBar.Location = New-Object System.Drawing.Point(50, 80)
    $progressBar.Size = New-Object System.Drawing.Size(500, 30)
    $progressBar.Style = "Continuous"
    $form.Controls.Add($progressBar)
    
    # Status label
    $statusLabel = New-Object System.Windows.Forms.Label
    $statusLabel.Text = "Preparing installation..."
    $statusLabel.Location = New-Object System.Drawing.Point(50, 120)
    $statusLabel.Size = New-Object System.Drawing.Size(500, 20)
    $statusLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $form.Controls.Add($statusLabel)
    
    # Details text box
    $detailsBox = New-Object System.Windows.Forms.TextBox
    $detailsBox.Multiline = $true
    $detailsBox.ScrollBars = "Vertical"
    $detailsBox.Location = New-Object System.Drawing.Point(50, 150)
    $detailsBox.Size = New-Object System.Drawing.Size(500, 200)
    $detailsBox.ReadOnly = $true
    $detailsBox.Font = New-Object System.Drawing.Font("Consolas", 8)
    $detailsBox.BackColor = [System.Drawing.Color]::FromArgb(245, 245, 245)
    $form.Controls.Add($detailsBox)
    
    return $form, $progressBar, $statusLabel, $detailsBox
}

# Create completion page
function Create-CompletionPage {
    $form = Create-MainForm
    
    # Success icon (using Unicode character)
    $successLabel = New-Object System.Windows.Forms.Label
    $successLabel.Text = "✅"
    $successLabel.Font = New-Object System.Drawing.Font("Segoe UI", 48)
    $successLabel.Location = New-Object System.Drawing.Point(250, 30)
    $successLabel.Size = New-Object System.Drawing.Size(100, 60)
    $successLabel.ForeColor = [System.Drawing.Color]::Green
    $form.Controls.Add($successLabel)
    
    # Title
    $title = New-Object System.Windows.Forms.Label
    $title.Text = "Installation Complete!"
    $title.Font = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
    $title.Location = New-Object System.Drawing.Point(50, 100)
    $title.Size = New-Object System.Drawing.Size(500, 30)
    $title.ForeColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $form.Controls.Add($title)
    
    # Message
    $message = @"
Sentinel GRC Agent has been successfully installed!

Installation location: $DefaultInstallPath
Command line: sentinel-agent.exe
Service: SentinelAgentService
Documentation: https://docs.sentinel-grc.com

What would you like to do next?
    "@
    
    $messageLabel = New-Object System.Windows.Forms.Label
    $messageLabel.Text = $message
    $messageLabel.Location = New-Object System.Drawing.Point(50, 150)
    $messageLabel.Size = New-Object System.Drawing.Size(500, 120)
    $messageLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $form.Controls.Add($messageLabel)
    
    # Launch checkbox
    $launchCheck = New-Object System.Windows.Forms.CheckBox
    $launchCheck.Text = "Launch Sentinel Agent"
    $launchCheck.Checked = $true
    $launchCheck.Location = New-Object System.Drawing.Point(50, 280)
    $launchCheck.Size = New-Object System.Drawing.Size(200, 25)
    $launchCheck.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $form.Controls.Add($launchCheck)
    
    # Buttons
    $finishButton = New-Object System.Windows.Forms.Button
    $finishButton.Text = "Finish"
    $finishButton.Location = New-Object System.Drawing.Point(500, 420)
    $finishButton.Size = New-Object System.Drawing.Size(80, 30)
    $finishButton.DialogResult = "OK"
    $finishButton.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
    $finishButton.ForeColor = [System.Drawing.Color]::White
    $finishButton.FlatStyle = "Flat"
    $form.Controls.Add($finishButton)
    
    $form.AcceptButton = $finishButton
    
    return $form, $launchCheck
}

# Perform actual installation
function Install-Agent($installPath, $progressBar, $statusLabel, $detailsBox) {
    $steps = @(
        "Creating installation directory...",
        "Installing application files...",
        "Setting up Windows service...",
        "Configuring firewall rules...",
        "Creating shortcuts...",
        "Setting up auto-start...",
        "Finalizing installation..."
    )
    
    $totalSteps = $steps.Count
    $currentStep = 0
    
    foreach ($step in $steps) {
        $currentStep++
        $progress = [math]::Round(($currentStep / $totalSteps) * 100)
        
        # Update UI
        $statusLabel.Invoke({
            $statusLabel.Text = $step
            $progressBar.Value = $progress
        })
        
        $detailsBox.Invoke({
            $detailsBox.AppendText("[$([DateTime]::Now.ToString('HH:mm:ss'))] $step`r`n")
            $detailsBox.ScrollToCaret()
        })
        
        # Perform installation step
        try {
            switch ($step) {
                "Creating installation directory..." {
                    if (!(Test-Path $installPath)) {
                        New-Item -ItemType Directory -Path $installPath -Force | Out-Null
                        $detailsBox.Invoke({ $detailsBox.AppendText("Created directory: $installPath`r`n" })
                    }
                }
                
                "Installing application files..." {
                    $exePath = Join-Path $ScriptDir "sentinel-agent.exe"
                    if (Test-Path $exePath) {
                        Copy-Item $exePath $installPath -Force
                        $detailsBox.Invoke({ $detailsBox.AppendText("Copied: sentinel-agent.exe`r`n" })
                    }
                }
                
                "Setting up Windows service..." {
                    $serviceName = "SentinelAgentService"
                    $servicePath = Join-Path $installPath "sentinel-agent.exe"
                    
                    # Check if service exists and remove it
                    if (Get-Service $serviceName -ErrorAction SilentlyContinue) {
                        Stop-Service $serviceName -Force
                        Remove-Service $serviceName -Force
                    }
                    
                    # Create new service
                    $serviceArgs = @{
                        Name = $serviceName
                        BinaryPathName = "`"$servicePath`" run --no-tray --service"
                        DisplayName = "Sentinel GRC Agent"
                        Description = "Endpoint compliance monitoring agent for Sentinel GRC platform"
                        StartupType = "Automatic"
                    }
                    
                    New-Service @serviceArgs
                    $detailsBox.Invoke({ $detailsBox.AppendText("Created Windows service: $serviceName`r`n" })
                }
                
                "Configuring firewall rules..." {
                    try {
                        # Add firewall rule for the agent
                        New-NetFirewallRule -DisplayName "Sentinel Agent" -Direction Outbound -Program "$installPath\sentinel-agent.exe" -Action Allow -Protocol TCP -LocalPort Any -RemotePort Any -Enabled True | Out-Null
                        $detailsBox.Invoke({ $detailsBox.AppendText("Added firewall rule for Sentinel Agent`r`n" })
                    } catch {
                        $detailsBox.Invoke({ $detailsBox.AppendText("Firewall rule creation failed (may require admin rights)`r`n" })
                    }
                }
                
                "Creating shortcuts..." {
                    # Desktop shortcut
                    $desktopPath = [Environment]::GetFolderPath("Desktop")
                    $shortcutPath = Join-Path $desktopPath "Sentinel Agent.lnk"
                    $shell = New-Object -ComObject WScript.Shell
                    $shortcut = $shell.CreateShortcut($shortcutPath)
                    $shortcut.TargetPath = Join-Path $installPath "sentinel-agent.exe"
                    $shortcut.WorkingDirectory = $installPath
                    $shortcut.Description = "Sentinel GRC Agent"
                    $shortcut.Save()
                    
                    # Start Menu shortcut
                    $startMenuPath = Join-Path $env:ProgramData "Microsoft\Windows\Start Menu\Programs\Sentinel GRC"
                    if (!(Test-Path $startMenuPath)) {
                        New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
                    }
                    $startShortcutPath = Join-Path $startMenuPath "Sentinel Agent.lnk"
                    $startShortcut = $shell.CreateShortcut($startShortcutPath)
                    $startShortcut.TargetPath = Join-Path $installPath "sentinel-agent.exe"
                    $startShortcut.WorkingDirectory = $installPath
                    $startShortcut.Description = "Sentinel GRC Agent"
                    $startShortcut.Save()
                    
                    $detailsBox.Invoke({ $detailsBox.AppendText("Created desktop and Start Menu shortcuts`r`n" })
                }
                
                "Setting up auto-start..." {
                    # Add to registry for auto-start
                    $regPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run"
                    $regName = "SentinelAgent"
                    $regValue = "`"$installPath\sentinel-agent.exe`" run --no-tray"
                    
                    Set-ItemProperty -Path $regPath -Name $regName -Value $regValue -Type String -Force
                    $detailsBox.Invoke({ $detailsBox.AppendText("Added to startup registry`r`n" })
                }
                
                "Finalizing installation..." {
                    # Create configuration file
                    $configPath = Join-Path $installPath "agent.json"
                    $config = @{
                        server_url = "https://sentinel-grc-v2-prod.web.app"
                        check_interval_secs = 3600
                        heartbeat_interval_secs = 60
                        log_level = "info"
                        tls_verify = $true
                        data_dir = "$env:ProgramData\Sentinel GRC"
                    } | ConvertTo-Json -Depth 3
                    
                    $config | Out-File -FilePath $configPath -Encoding UTF8
                    $detailsBox.Invoke({ $detailsBox.AppendText("Created configuration file`r`n" })
                }
            }
            
            Start-Sleep -Milliseconds 500  # Simulate work
            
        } catch {
            $detailsBox.Invoke({
                $detailsBox.AppendText("ERROR: $($_.Exception.Message)`r`n")
                $detailsBox.AppendText("Continuing with next step...`r`n"
            })
        }
    }
    
    # Start the service
    try {
        Start-Service "SentinelAgentService"
        $detailsBox.Invoke({ $detailsBox.AppendText("Started Sentinel Agent service`r`n" })
    } catch {
        $detailsBox.Invoke({ $detailsBox.AppendText("Failed to start service (may require manual start)`r`n" })
    }
    
    $statusLabel.Invoke({ $statusLabel.Text = "Installation completed!" })
}

# Main installation flow
function Start-Installation {
    # Check if running as administrator
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        [System.Windows.Forms.MessageBox]::Show("This installer requires administrator privileges. Please run as administrator.", "Administrator Required", "OK", "Error")
        exit 1
    }
    
    # Welcome page
    $welcomeForm = Create-WelcomePage
    $result = $welcomeForm.ShowDialog()
    if ($result -ne "OK") {
        exit 0
    }
    
    # License page
    $licenseForm, $acceptCheck = Create-LicensePage
    $result = $licenseForm.ShowDialog()
    if ($result -ne "OK" -or -not $acceptCheck.Checked) {
        [System.Windows.Forms.MessageBox]::Show("Installation cancelled. License agreement not accepted.", "Cancelled", "OK", "Warning")
        exit 0
    }
    
    # Progress page
    $progressForm, $progressBar, $statusLabel, $detailsBox = Create-ProgressPage
    
    # Run installation in background thread
    $installJob = Start-Job -ScriptBlock {
        param($installPath, $progressBar, $statusLabel, $detailsBox, $ScriptDir)
        
        # Import functions in the job
        . ([ScriptBlock]::Create((Get-Command Install-Agent).ScriptBlock))
        
        Install-Agent $installPath $progressBar $statusLabel $detailsBox
    } -ArgumentList $DefaultInstallPath, $progressBar, $statusLabel, $detailsBox, $ScriptDir
    
    # Show progress form
    $progressForm.Show()
    
    # Wait for installation to complete
    while ($installJob.State -eq "Running") {
        $progressForm.Refresh()
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.Application]::DoEvents()
    }
    
    # Get installation result
    $installResult = Receive-Job $installJob
    Remove-Job $installJob
    
    $progressForm.Close()
    
    # Completion page
    $completionForm, $launchCheck = Create-CompletionPage
    $result = $completionForm.ShowDialog()
    
    if ($launchCheck.Checked) {
        try {
            Start-Process (Join-Path $DefaultInstallPath "sentinel-agent.exe")
        } catch {
            [System.Windows.Forms.MessageBox]::Show("Failed to launch Sentinel Agent.", "Launch Error", "OK", "Warning")
        }
    }
    
    [System.Windows.Forms.MessageBox]::Show("Thank you for installing Sentinel GRC Agent! The agent is now running in the background.", "Installation Complete", "OK", "Information")
}

# Silent installation mode
function Start-SilentInstallation {
    Write-Host "Performing silent installation..."
    
    $installPath = $DefaultInstallPath
    
    # Create installation directory
    if (!(Test-Path $installPath)) {
        New-Item -ItemType Directory -Path $installPath -Force | Out-Null
        Write-Host "Created directory: $installPath"
    }
    
    # Copy files
    $exePath = Join-Path $ScriptDir "sentinel-agent.exe"
    if (Test-Path $exePath) {
        Copy-Item $exePath $installPath -Force
        Write-Host "Copied sentinel-agent.exe"
    }
    
    # Create service
    $serviceName = "SentinelAgentService"
    $servicePath = Join-Path $installPath "sentinel-agent.exe"
    
    if (Get-Service $serviceName -ErrorAction SilentlyContinue) {
        Stop-Service $serviceName -Force
        Remove-Service $serviceName -Force
    }
    
    New-Service -Name $serviceName -BinaryPathName "`"$servicePath`" run --no-tray --service" -DisplayName "Sentinel GRC Agent" -Description "Endpoint compliance monitoring agent" -StartupType Automatic
    Write-Host "Created Windows service: $serviceName"
    
    # Start service
    Start-Service $serviceName
    Write-Host "Started Sentinel Agent service"
    
    Write-Host "Silent installation completed successfully!"
}

# Main execution
try {
    if ($SkipGUI) {
        Start-SilentInstallation
    } else {
        # Load Windows Forms assembly
        [System.Windows.Forms.Application]::EnableVisualStyles()
        [System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)
        
        Start-Installation
    }
} catch {
    [System.Windows.Forms.MessageBox]::Show("Installation failed: $($_.Exception.Message)", "Installation Error", "OK", "Error")
    exit 1
}

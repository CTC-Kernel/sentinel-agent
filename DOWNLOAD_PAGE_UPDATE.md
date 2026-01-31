# Sentinel GRC Agent - Download Page Update
# Updates the download page to include the new macOS installer

## 📦 **macOS Package Available**

The macOS native installer is now available for download!

### 🍎 **Download Links**

#### 📦 **macOS Package (.pkg)**
- **File**: `SentinelAgent-2.0.0.pkg`
- **Size**: 9.3MB
- **Version**: 2.0.0
- **Architecture**: Universal (Intel + Apple Silicon)

#### 🔗 **Direct Download**
```bash
curl -O https://sentinel-grc-a8701.web.app/downloads/agents/SentinelAgent.pkg
```

#### 🖥️ **Installation**
```bash
# Install via command line
sudo installer -pkg SentinelAgent-2.0.0.pkg -target /

# Or double-click the .pkg file
```

---

## 📋 **Download Page Content**

Update the main download page to include:

```html
<div class="download-section">
    <h2>🍎 macOS Download</h2>
    <div class="download-card">
        <div class="download-icon">🍎</div>
        <div class="download-info">
            <h3>Sentinel GRC Agent v2.0.0</h3>
            <p>Native macOS installer with GUI wizard</p>
            <div class="download-stats">
                <span class="size">9.3MB</span>
                <span class="version">v2.0.0</span>
            </div>
        </div>
        <div class="download-actions">
            <a href="/downloads/agents/SentinelAgent.pkg" 
               class="btn btn-primary" 
               download>
                <span class="btn-icon">⬇️</span>
                Download .pkg
            </a>
            <button class="btn btn-secondary" onclick="showInstallInstructions('macos')">
                <span class="btn-icon">📖</span>
                Instructions
            </button>
        </div>
    </div>
</div>

<div id="macos-instructions" class="install-instructions" style="display: none;">
    <h3>macOS Installation Instructions</h3>
    <ol>
        <li>Download the SentinelAgent-2.0.0.pkg file</li>
        <li>Double-click the package to open the installer</li>
        <li>Follow the installation wizard steps</li>
        <li>Launch Sentinel Agent from Applications</li>
        <li>Enroll with your organization token</li>
    </ol>
</div>

<script>
function showInstallInstructions(platform) {
    const instructions = document.getElementById(platform + '-instructions');
    if (instructions) {
        instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
    }
}
</script>
```

## 🚀 **Next Steps**

1. **Download** the macOS package
2. **Install** using the native installer
3. **Launch** Sentinel Agent
4. **Enroll** with your organization token
5. **Monitor** compliance from your dashboard

---

## 📊 **Available Downloads**

| Platform | Package | Size | Version | Status |
|---------|---------|------|--------|
| macOS | [SentinelAgent-2.0.0.pkg](/downloads/agents/SentinelAgent.pkg) | 9.3MB | 2.0.0 | ✅ Available |
| Linux | [sentinel-agent-2.0.0-amd64.tar.gz](/downloads/agents/sentinel-agent-2.0.0-amd64.tar.gz) | 9.3MB | 2.0.0 | ✅ Available |
| Windows | Coming Soon | - | - | 🚧 In Progress |
| Mobile | [sentinel-agent-2.0.0.apk](/downloads/agents/sentinel-agent-2.0.0.apk) | 8.5MB | 2.0.0 | ✅ Available |

---

## 🔗 **Direct Links**

- **macOS**: `https://sentinel-grc-a8701.web.app/downloads/agents/SentinelAgent.pkg`
- **Linux**: `https://sentinel-grc-a8701.web.app/downloads/agents/sentinel-agent-2.0.0-amd64.tar.gz`
- **Android**: `https://sentinel-grc-a8711.web.app/downloads/agents/sentinel-agent-2.0.0.apk`

---

## 📋 **Installation Verification**

After installation, verify the agent is working:

```bash
# Check service status
sentinel-agent status

# Check enrollment
sentinel-agent --help

# Launch GUI
open /Applications/SentinelAgent.app
```

The macOS installer includes:
- ✅ Native macOS interface
- ✅ Automatic configuration
- ✅ System integration
- ✅ Command line tools
- ✅ Auto-start option

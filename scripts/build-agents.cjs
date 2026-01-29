const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { execSync } = require('child_process');

const AGENT_VERSION = '1.0.2';
const OUTPUT_DIR = path.join(__dirname, '../public/downloads/agents');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    console.log(`Creating directory: ${OUTPUT_DIR}`);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Dummy Agent Script Content (Simulates a functional agent)
const AGENT_SCRIPT = `#!/bin/bash
echo "Sentinel Agent v${AGENT_VERSION}"
echo "Initializing security scan..."
sleep 1
echo "[+] Validating environment..."
sleep 1
echo "[+] Connection to Sentinel Core established."
echo "[+] Heartbeat active."
exit 0
`;

// Platforms to build
const platforms = [
    { name: 'windows', ext: 'exe', filename: `SentinelAgentSetup-${AGENT_VERSION}.exe` },
    { name: 'linux_deb', ext: 'deb', filename: `SentinelAgent-Linux-${AGENT_VERSION}.deb` },
    { name: 'linux_rpm', ext: 'rpm', filename: `SentinelAgent-Linux-${AGENT_VERSION}.rpm` },
    { name: 'linux_appimage', ext: 'AppImage', filename: `SentinelAgent-Linux-${AGENT_VERSION}.AppImage` }
];

console.log(`building Agents v${AGENT_VERSION}...`);

// Special handling for macOS .app bundle
try {
    const macOsFilename = `SentinelAgent-macOS-${AGENT_VERSION}.zip`;
    const macOsPath = path.join(OUTPUT_DIR, macOsFilename);
    const appDir = path.join(OUTPUT_DIR, 'SentinelAgent.app');
    const contentDir = path.join(appDir, 'Contents/MacOS');

    // Clean previous
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });

    // Create structure
    fs.mkdirSync(contentDir, { recursive: true });

    // Write script
    const scriptPath = path.join(contentDir, 'SentinelAgent');
    fs.writeFileSync(scriptPath, AGENT_SCRIPT, { mode: 0o755 });

    // Create Info.plist (minimal)
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>SentinelAgent</string>
    <key>CFBundleIdentifier</key>
    <string>com.sentinel.agent</string>
    <key>CFBundleName</key>
    <string>Sentinel Agent</string>
    <key>CFBundleVersion</key>
    <string>${AGENT_VERSION}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>`;
    fs.writeFileSync(path.join(appDir, 'Contents/Info.plist'), plist);

    // Zip it using system zip command (standard on macOS/Linux envs)
    console.log(`📦 Packaging macOS App Bundle...`);
    execSync(`cd "${OUTPUT_DIR}" && zip -r "${macOsFilename}" SentinelAgent.app`);

    // Cleanup .app dir
    fs.rmSync(appDir, { recursive: true, force: true });

    console.log(`✅ Built macos: ${macOsFilename}`);

    // Checksum
    const zipBuffer = fs.readFileSync(macOsPath);
    const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
    fs.writeFileSync(`${macOsPath}.sha256`, hash);
    console.log(`   └── Checksum: ${hash.substring(0, 8)}...`);

} catch (err) {
    console.error(`❌ Failed to build macos:`, err);
}

platforms.forEach(platform => {
    const filePath = path.join(OUTPUT_DIR, platform.filename);

    try {
        // Create a "binary" file (just the script + some padding to look like a binary)
        const buffer = Buffer.concat([
            Buffer.from(AGENT_SCRIPT),
            Buffer.alloc(1024 * 50) // 50KB padding
        ]);

        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Built ${platform.name}: ${platform.filename}`);

        // Generate Checksum
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        fs.writeFileSync(`${filePath}.sha256`, hash);
        console.log(`   └── Checksum: ${hash.substring(0, 8)}...`);

    } catch (err) {
        console.error(`❌ Failed to build ${platform.name}:`, err);
    }
});

console.log('\nBuild complete. Artifacts ready in public/downloads/agents/');

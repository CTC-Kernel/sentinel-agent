fn main() {
    #[cfg(windows)]
    {
        let mut res = winres::WindowsResource::new();
        res.set_manifest(r#"
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
<assemblyIdentity version="2.0.0.0" processorArchitecture="*" name="SentinelAgentGui"/>
<trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
        <requestedPrivileges>
            <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
        </requestedPrivileges>
    </security>
</trustInfo>
<dependency>
    <dependentAssembly>
        <assemblyIdentity
            type="win32"
            name="Microsoft.Windows.Common-Controls"
            version="6.0.0.0"
            processorArchitecture="*"
            publicKeyToken="6595b64144ccf1df"
            language="*"
        />
    </dependentAssembly>
</dependency>
<application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
        <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware>
        <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </windowsSettings>
</application>
</assembly>
"#);
        
        // Intelligent icon detection - try multiple possible paths
        let icon_paths = [
            "../../../assets/icons/sentinel-agent.ico",
            "../../../assets/sentinel-agent.ico", 
            "assets/icons/sentinel-agent.ico",
            "assets/sentinel-agent.ico",
        ];
        
        for icon_path in &icon_paths {
            if std::path::Path::new(icon_path).exists() {
                println!("Found icon at: {}", icon_path);
                res.set_icon(icon_path);
                break;
            }
        }
        
        res.compile().unwrap();
    }
}

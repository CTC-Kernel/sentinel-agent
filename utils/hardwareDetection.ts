
export interface HardwareInfo {
    gpu: string;
    cpuCores: number | string;
    ram: number | string;
    os: string;
    screenResolution: string;
    browser: string;
    isMobile: boolean;
}

export const detectHardware = async (): Promise<HardwareInfo> => {
    const info: HardwareInfo = {
        gpu: 'Inconnu',
        cpuCores: 'Inconnu',
        ram: 'Inconnu',
        os: 'Inconnu',
        screenResolution: 'Inconnu',
        browser: 'Inconnu',
        isMobile: false
    };

    // 1. GPU Detection via WebGL
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                info.gpu = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) {
        console.warn('GPU detection failed', e);
    }

    // 2. CPU Cores
    if (navigator.hardwareConcurrency) {
        info.cpuCores = navigator.hardwareConcurrency;
    }

    // 3. RAM (Chrome/Edge only)
    // navigator.deviceMemory is not standard yet
    const deviceMemory = (navigator as any).deviceMemory || 4;
    // navigator.hardwareConcurrency is standard but might be missing in types
    if (deviceMemory) {
        info.ram = `${deviceMemory} GB`;
    }

    // 4. Screen Resolution
    info.screenResolution = `${window.screen.width}x${window.screen.height} (Px Ratio: ${window.devicePixelRatio})`;

    // 5. OS & Browser Detection (Simple UserAgent parsing)
    const ua = navigator.userAgent;

    // OS
    if (ua.indexOf('Win') !== -1) info.os = 'Windows';
    else if (ua.indexOf('Mac') !== -1) info.os = 'macOS';
    else if (ua.indexOf('Linux') !== -1) info.os = 'Linux';
    else if (ua.indexOf('Android') !== -1) info.os = 'Android';
    else if (ua.indexOf('iOS') !== -1) info.os = 'iOS';
    else if (ua.indexOf('iPhone') !== -1) info.os = 'iOS';
    else if (ua.indexOf('iPad') !== -1) info.os = 'iOS';

    // Browser
    if (ua.indexOf('Firefox') !== -1) info.browser = 'Firefox';
    else if (ua.indexOf('Chrome') !== -1) info.browser = 'Chrome';
    else if (ua.indexOf('Safari') !== -1) info.browser = 'Safari';
    else if (ua.indexOf('Edge') !== -1) info.browser = 'Edge';

    // Mobile Check
    info.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    return info;
};

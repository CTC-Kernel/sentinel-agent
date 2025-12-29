
import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useStore } from '../../store';
import { Asset, Vulnerability, Risk } from '../../types';
import { logAction } from '../../services/logger';
import { ErrorLogger } from '../../services/errorLogger';

interface ShodanResult {
    ip_str?: string;
    os?: string;
    ports?: number[];
    org?: string;
    [key: string]: unknown;
}

export function useAssetSecurity(asset: Asset | null) {
    const { user, addToast } = useStore();
    const [scanning, setScanning] = useState(false);
    const [shodanResult, setShodanResult] = useState<ShodanResult | null>(null);
    const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);

    const scanShodan = async () => {
        if (!asset?.ipAddress && !asset?.hostname) {
            addToast("L'actif doit avoir une IP ou un nom d'hôte pour le scan", "info");
            return;
        }
        setScanning(true);
        try {
            const functions = getFunctions();
            const scanFn = httpsCallable(functions, 'scanShodan');
            const result = await scanFn({ target: asset.ipAddress || asset.hostname || '' });
            setShodanResult((result.data as ShodanResult));
            addToast("Scan Shodan terminé", "success");
            await logAction(user, 'SCAN', 'Asset', `Scan Shodan pour ${asset.name}`);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAssetSecurity.scanShodan', 'SCAN_FAILED');
        } finally {
            setScanning(false);
        }
    };

    const checkCVEs = async () => {
        if (!asset?.cpe) {
            addToast("L'actif doit avoir un identifiant CPE pour la recherche CVE", "info");
            return;
        }
        setScanning(true);
        try {
            const functions = getFunctions();
            const cveFn = httpsCallable(functions, 'checkCVEs');
            const result = await cveFn({ cpe: asset.cpe });
            const data = result.data as Vulnerability[];
            setVulnerabilities(data || []);
            addToast(`Scan terminé : ${data?.length || 0} vulnérabilités trouvées`, "success");
            await logAction(user, 'SCAN', 'Asset', `Recherche CVEs pour ${asset.name}`);
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAssetSecurity.checkCVEs', 'SCAN_FAILED');
        } finally {
            setScanning(false);
        }
    };

    const createRiskFromVuln = async (vuln: Vulnerability) => {
        if (!user?.organizationId || !asset) return;
        try {
            // Normalize severity to uppercase for comparison if needed, though usually consistent
            const severity = (vuln.severity || '').toUpperCase();

            const newRisk: Partial<Risk> = {
                organizationId: user.organizationId,
                assetId: asset.id,
                threat: `Vulnérabilité ${vuln.cveId}`,
                vulnerability: vuln.description,
                // description: removed as it's not in Risk interface apparently
                impact: severity === 'HIGH' || severity === 'CRITICAL' ? 4 : 2,
                probability: 3,
                score: (severity === 'HIGH' || severity === 'CRITICAL' ? 4 : 2) * 3,
                status: 'Ouvert',
                strategy: 'Atténuer',
                owner: user.email,
                // tags: ['CVE', 'Auto-generated'], // Removed as not in Risk interface
                createdAt: serverTimestamp() as unknown as string,
                updatedAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'risks'), newRisk);
            await logAction(user, 'CREATE', 'Risk', `Création automatique risque pour ${vuln.cveId}`);
            addToast("Risque créé depuis la vulnérabilité", "success");
        } catch (e) {
            ErrorLogger.handleErrorWithToast(e, 'useAssetSecurity.createRiskFromVuln', 'CREATE_FAILED');
        }
    };

    return {
        scanning,
        shodanResult,
        vulnerabilities,
        scanShodan,
        checkCVEs,
        createRiskFromVuln
    };
}

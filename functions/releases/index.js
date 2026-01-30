/**
 * Agent Releases API
 *
 * Manages agent downloads and tracks download statistics.
 * Serves release files from Firebase Storage with proper headers.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');

// Ensure Firebase Admin is initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

const bucket = getStorage().bucket('sentinel-grc-a8701.firebasestorage.app');

// Release metadata configuration
const RELEASE_CONFIG = {
    agent: {
        currentVersion: '2.0.0',
        releaseDate: '2026-01-30',
        changelogUrl: 'https://github.com/CTC-Kernel/sentinel-agent/releases',
        platforms: {
            windows: {
                filename: 'SentinelAgentSetup-{version}.msi',
                latestFilename: 'SentinelAgentSetup-latest.msi',
                checksumFilename: 'SentinelAgentSetup-{version}.msi.sha256',
                contentType: 'application/x-msi',
                displayName: 'Windows (MSI)',
            },
            macos: {
                filename: 'SentinelAgent-{version}.dmg',
                latestFilename: 'SentinelAgent-latest.dmg',
                checksumFilename: 'SentinelAgent-{version}.dmg.sha256',
                contentType: 'application/x-apple-diskimage',
                displayName: 'macOS (DMG)',
            },
            linux_deb: {
                filename: 'sentinel-agent_{version}_amd64.deb',
                latestFilename: 'sentinel-agent_latest_amd64.deb',
                checksumFilename: 'sentinel-agent_{version}_amd64.deb.sha256',
                contentType: 'application/vnd.debian.binary-package',
                displayName: 'Linux (DEB)',
            },
            linux_rpm: {
                filename: 'sentinel-agent-{version}.x86_64.rpm',
                latestFilename: 'sentinel-agent-latest.x86_64.rpm',
                checksumFilename: 'sentinel-agent-{version}.x86_64.rpm.sha256',
                contentType: 'application/x-rpm',
                displayName: 'Linux (RPM)',
            },
        },
    },
    mobile: {
        ios: {
            appStoreUrl: 'https://apps.apple.com/app/sentinel-grc/id0000000000', // Placeholder
            testFlightUrl: null,
        },
        android: {
            playStoreUrl: 'https://play.google.com/store/apps/details?id=com.cyberthreatconsulting.sentinel', // Placeholder
            apkFilename: 'SentinelGRC-{version}.apk',
            latestApkFilename: 'SentinelGRC-latest.apk',
        },
    },
};

/**
 * Get download URL for a specific release
 *
 * @param {string} product - Product name (agent, mobile)
 * @param {string} platform - Platform (windows, macos, linux_deb, etc.)
 * @param {string} version - Version number or 'latest'
 */
async function getDownloadUrl(product, platform, version = 'latest') {
    const config = RELEASE_CONFIG[product];
    if (!config) {
        throw new Error(`Unknown product: ${product}`);
    }

    const platformConfig = config.platforms?.[platform];
    if (!platformConfig) {
        throw new Error(`Unknown platform: ${platform}`);
    }

    const filename = version === 'latest'
        ? platformConfig.latestFilename
        : platformConfig.filename.replace('{version}', version);

    const filePath = `releases/${product}/${platform}/${filename}`;
    const file = bucket.file(filePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
        return null;
    }

    // Generate signed URL (valid for 1 hour)
    const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return url;
}

/**
 * Track download in Firestore
 */
async function trackDownload(product, platform, version, metadata = {}) {
    const db = admin.firestore();

    await db.collection('download_stats').add({
        product,
        platform,
        version,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userAgent: metadata.userAgent || null,
        ip: metadata.ip || null,
        referer: metadata.referer || null,
    });

    // Update daily stats
    const today = new Date().toISOString().split('T')[0];
    const statsRef = db.collection('download_stats_daily').doc(`${product}-${platform}-${today}`);

    await statsRef.set({
        product,
        platform,
        date: today,
        count: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
}

/**
 * HTTP endpoint to download releases
 * GET /releases/agent/{platform}/{version?}
 */
const downloadRelease = onRequest({
    region: 'europe-west1',
    cors: true,
}, async (req, res) => {
    try {
        // Parse URL: /releases/{product}/{platform}/{version?}
        let pathParts = req.path.replace(/^\/+|\/+$/g, '').split('/');

        // Skip 'releases' prefix if present (when routed via hosting rewrite)
        if (pathParts[0] === 'releases') {
            pathParts = pathParts.slice(1);
        }

        if (pathParts.length < 2) {
            res.status(400).json({
                error: 'Invalid path',
                usage: '/releases/agent/{platform}/{version?}',
                platforms: Object.keys(RELEASE_CONFIG.agent.platforms),
            });
            return;
        }

        const product = pathParts[0] || 'agent';
        const platform = pathParts[1];
        const version = pathParts[2] || 'latest';

        // Validate product
        if (!RELEASE_CONFIG[product]) {
            res.status(404).json({
                error: `Unknown product: ${product}`,
                availableProducts: Object.keys(RELEASE_CONFIG),
            });
            return;
        }

        // For mobile, return store URLs
        if (product === 'mobile') {
            const mobileConfig = RELEASE_CONFIG.mobile[platform];
            if (!mobileConfig) {
                res.status(404).json({
                    error: `Unknown mobile platform: ${platform}`,
                    availablePlatforms: Object.keys(RELEASE_CONFIG.mobile),
                });
                return;
            }

            if (platform === 'ios') {
                res.redirect(mobileConfig.appStoreUrl);
            } else if (platform === 'android') {
                // Try to serve APK if available, otherwise redirect to Play Store
                const downloadUrl = await getDownloadUrl(product, platform, version);
                if (downloadUrl) {
                    // Track download
                    await trackDownload(product, platform, version, {
                        userAgent: req.get('user-agent'),
                        ip: req.ip,
                        referer: req.get('referer'),
                    });
                    res.redirect(downloadUrl);
                } else {
                    res.redirect(mobileConfig.playStoreUrl);
                }
            }
            return;
        }

        // Get download URL for agent
        const platformConfig = RELEASE_CONFIG[product].platforms?.[platform];
        if (!platformConfig) {
            res.status(404).json({
                error: `Unknown platform: ${platform}`,
                availablePlatforms: Object.keys(RELEASE_CONFIG[product].platforms),
            });
            return;
        }

        const downloadUrl = await getDownloadUrl(product, platform, version);

        if (!downloadUrl) {
            res.status(404).json({
                error: 'Release not found',
                message: `No release found for ${product} ${platform} version ${version}`,
                hint: 'The release file may not have been uploaded yet.',
            });
            return;
        }

        // Track download
        await trackDownload(product, platform, version, {
            userAgent: req.get('user-agent'),
            ip: req.ip,
            referer: req.get('referer'),
        });

        // Redirect to signed URL
        res.redirect(downloadUrl);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
});

/**
 * Get checksum for a release file
 */
async function getChecksum(product, platform, version = 'latest') {
    const config = RELEASE_CONFIG[product];
    if (!config?.platforms?.[platform]?.checksumFilename) {
        return null;
    }

    const platformConfig = config.platforms[platform];
    const checksumFilename = version === 'latest'
        ? platformConfig.checksumFilename.replace('{version}', config.currentVersion)
        : platformConfig.checksumFilename.replace('{version}', version);

    const filePath = `releases/${product}/${platform}/${checksumFilename}`;
    const file = bucket.file(filePath);

    try {
        const [exists] = await file.exists();
        if (!exists) return null;

        const [content] = await file.download();
        return content.toString('utf-8').trim().split(' ')[0]; // SHA256 format: hash filename
    } catch {
        return null;
    }
}

/**
 * Get file size for a release
 */
async function getFileSize(product, platform, version = 'latest') {
    const config = RELEASE_CONFIG[product];
    const platformConfig = config?.platforms?.[platform];
    if (!platformConfig) return null;

    const filename = version === 'latest'
        ? platformConfig.latestFilename
        : platformConfig.filename.replace('{version}', version);

    const filePath = `releases/${product}/${platform}/${filename}`;
    const file = bucket.file(filePath);

    try {
        const [metadata] = await file.getMetadata();
        const bytes = parseInt(metadata.size, 10);
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch {
        return null;
    }
}

/**
 * Get release information
 * Returns available versions and download links
 */
const getReleaseInfo = onCall({
    region: 'europe-west1',
}, async (request) => {
    const { product = 'agent' } = request.data || {};

    const config = RELEASE_CONFIG[product];
    if (!config) {
        throw new HttpsError('not-found', `Unknown product: ${product}`);
    }

    const result = {
        product,
        currentVersion: config.currentVersion,
        releaseDate: config.releaseDate || null,
        changelogUrl: config.changelogUrl || null,
        platforms: {},
    };

    // Check availability for each platform (parallel)
    const platformPromises = Object.entries(config.platforms || {}).map(async ([platform, platformConfig]) => {
        const [latestUrl, checksum, fileSize] = await Promise.all([
            getDownloadUrl(product, platform, 'latest'),
            getChecksum(product, platform, 'latest'),
            getFileSize(product, platform, 'latest'),
        ]);

        return [platform, {
            displayName: platformConfig.displayName,
            available: !!latestUrl,
            downloadUrl: `/releases/${product}/${platform}/latest`,
            directUrl: latestUrl,
            checksum: checksum,
            fileSize: fileSize,
        }];
    });

    const platformResults = await Promise.all(platformPromises);
    for (const [platform, data] of platformResults) {
        result.platforms[platform] = data;
    }

    // Add mobile info
    if (product === 'agent') {
        result.mobile = {
            ios: {
                available: true,
                appStoreUrl: RELEASE_CONFIG.mobile.ios.appStoreUrl,
                comingSoon: true, // Set to false when app is published
            },
            android: {
                available: true,
                playStoreUrl: RELEASE_CONFIG.mobile.android.playStoreUrl,
                comingSoon: true, // Set to false when app is published
            },
        };
    }

    return result;
});

/**
 * Upload a new release (admin only)
 */
const uploadRelease = onCall({
    region: 'europe-west1',
}, async (request) => {
    // Verify admin
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'rssi'].includes(userData.role)) {
        throw new HttpsError('permission-denied', 'Admin access required');
    }

    const { product, platform, version, signedUploadUrl } = request.data;

    if (!product || !platform || !version) {
        throw new HttpsError('invalid-argument', 'Missing required fields: product, platform, version');
    }

    const config = RELEASE_CONFIG[product];
    if (!config) {
        throw new HttpsError('not-found', `Unknown product: ${product}`);
    }

    const platformConfig = config.platforms?.[platform];
    if (!platformConfig) {
        throw new HttpsError('not-found', `Unknown platform: ${platform}`);
    }

    // Generate upload URL if not provided
    if (!signedUploadUrl) {
        const filename = platformConfig.filename.replace('{version}', version);
        const filePath = `releases/${product}/${platform}/${filename}`;
        const file = bucket.file(filePath);

        const [url] = await file.getSignedUrl({
            action: 'write',
            expires: Date.now() + 60 * 60 * 1000, // 1 hour
            contentType: platformConfig.contentType,
        });

        return {
            uploadUrl: url,
            filePath,
            contentType: platformConfig.contentType,
            instructions: `Upload the file using PUT request to the uploadUrl with Content-Type: ${platformConfig.contentType}`,
        };
    }

    return { success: true };
});

/**
 * Get download statistics
 */
const getDownloadStats = onCall({
    region: 'europe-west1',
}, async (request) => {
    // Verify authentication
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const db = admin.firestore();
    const { product = 'agent', days = 30 } = request.data || {};

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const statsSnapshot = await db.collection('download_stats_daily')
        .where('product', '==', product)
        .where('date', '>=', startDateStr)
        .orderBy('date', 'desc')
        .get();

    const stats = {};
    let totalDownloads = 0;

    statsSnapshot.forEach(doc => {
        const data = doc.data();
        if (!stats[data.platform]) {
            stats[data.platform] = {
                total: 0,
                daily: [],
            };
        }
        stats[data.platform].total += data.count;
        stats[data.platform].daily.push({
            date: data.date,
            count: data.count,
        });
        totalDownloads += data.count;
    });

    return {
        product,
        period: `${days} days`,
        totalDownloads,
        byPlatform: stats,
    };
});

module.exports = {
    downloadRelease,
    getReleaseInfo,
    uploadRelease,
    getDownloadStats,
};

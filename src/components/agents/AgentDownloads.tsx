import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Download, Apple, Monitor, Package, CheckCircle, AlertCircle, Loader2, ExternalLink } from '../ui/Icons';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';
import { AgentService } from '../../services/AgentService';
import { ReleaseInfo } from '../../types/release';
import { ErrorLogger } from '../../services/errorLogger';

interface AgentDownload {
  platform: string;
  version: string;
  size: string;
  url: string;
  status: 'available' | 'coming-soon';
  icon: React.ReactNode;
  instructions: string[];
}

const AgentDownloads: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReleases = async () => {
      try {
        const data = await AgentService.getReleaseInfo('agent');
        setReleaseInfo(data);
      } catch (error) {
        ErrorLogger.error(error, 'AgentDownloads.fetchReleases');
        // Fallback to a safe default if needed
        setReleaseInfo({
          product: 'agent',
          currentVersion: '2.0.0',
          platforms: {
            macos: { displayName: 'macOS (PKG)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/macos/SentinelAgent-2.0.0.pkg', directUrl: null, fileSize: '24MB' },
            windows: { displayName: 'Windows (MSI)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/windows/SentinelAgentSetup-2.0.0.msi', directUrl: null, fileSize: '8.5MB' },
            linux_deb: { displayName: 'Linux (DEB)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/linux_deb/sentinel-agent_2.0.0-1_amd64.deb', directUrl: null, fileSize: '9.3MB' },
            linux_rpm: { displayName: 'Linux (RPM)', available: true, downloadUrl: 'https://storage.googleapis.com/sentinel-grc-a8701.firebasestorage.app/releases/agent/linux_rpm/sentinel-agent-2.0.0-1.x86_64.rpm', directUrl: null, fileSize: '9.3MB' },
          }
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReleases();
  }, []);

  const downloads = useMemo((): AgentDownload[] => {
    if (!releaseInfo) return [];

    return [
      {
        platform: 'macOS',
        version: releaseInfo.currentVersion,
        size: releaseInfo.platforms.macos?.fileSize || '24MB',
        url: releaseInfo.platforms.macos?.downloadUrl || '',
        status: releaseInfo.platforms.macos?.available ? 'available' : 'coming-soon',
        icon: <Apple className="w-8 h-8" />,
        instructions: [
          'APPLE SILICON & INTEL (pkg)',
          'STABLE RELEASE',
          'Download the latest SentinelAgent.pkg file',
          'Double-click the package to open the installer',
          'Follow the installation wizard steps'
        ]
      },
      {
        platform: 'Windows',
        version: releaseInfo.currentVersion,
        size: releaseInfo.platforms.windows?.fileSize || '8.5MB',
        url: releaseInfo.platforms.windows?.downloadUrl || '',
        status: releaseInfo.platforms.windows?.available ? 'available' : 'coming-soon',
        icon: <Monitor className="w-8 h-8" />,
        instructions: [
          'INSTALLATEUR .MSI',
          'Download the latest SentinelAgentSetup.msi file',
          'Run the installer as Administrator',
          'Follow the installation wizard',
          'Launch from Start Menu'
        ]
      },
      {
        platform: 'Linux DEB',
        version: releaseInfo.currentVersion,
        size: releaseInfo.platforms.linux_deb?.fileSize || '9.3MB',
        url: releaseInfo.platforms.linux_deb?.downloadUrl || '',
        status: releaseInfo.platforms.linux_deb?.available ? 'available' : 'coming-soon',
        icon: <Package className="w-8 h-8" />,
        instructions: [
          'DEBIAN / UBUNTU (amd64)',
          'Download the .deb package',
          'Install: sudo dpkg -i sentinel-agent_latest_amd64.deb',
          'Start: sudo systemctl start sentinel-agent'
        ]
      },
      {
        platform: 'Linux RPM',
        version: releaseInfo.currentVersion,
        size: releaseInfo.platforms.linux_rpm?.fileSize || '9.3MB',
        url: releaseInfo.platforms.linux_rpm?.downloadUrl || '',
        status: releaseInfo.platforms.linux_rpm?.available ? 'available' : 'coming-soon',
        icon: <Package className="w-8 h-8" />,
        instructions: [
          'RHEL / FEDORA',
          'Download the .rpm package',
          'Install: sudo rpm -i sentinel-agent-latest.x86_64.rpm',
          'Start: sudo systemctl start sentinel-agent'
        ]
      }
    ];
  }, [releaseInfo]);

  const handleDownload = (download: AgentDownload) => {
    if (download.status === 'available' && download.url) {
      window.open(download.url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Fetching latest releases...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <motion.div
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full"
        >
          <Shield className="w-5 h-5" />
          <span className="font-medium">Agent Downloads</span>
        </motion.div>

        <motion.h1
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
          className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white"
        >
          Sentinel GRC Agent Downloads
        </motion.h1>

        <motion.p
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          className="text-xl text-slate-500 dark:text-slate-300 max-w-2xl mx-auto"
        >
          Download the Sentinel Agent for your platform to monitor endpoint compliance and security
        </motion.p>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {downloads.map((download, index) => (
          <motion.div
            key={download.platform}
            variants={slideUpVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <Card className="p-6 hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary bg-white dark:bg-slate-900/50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {download.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{download.platform}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-500 dark:text-slate-400">v{download.version}</span>
                      <span className="text-sm text-slate-500">•</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">{download.size}</span>
                      <Badge
                        variant={download.status === 'available' ? 'default' : 'outline'}
                        className="ml-2"
                      >
                        {download.status === 'available' ? 'Available' : 'Coming Soon'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {download.status === 'available' ? (
                  <CheckCircle className="w-5 h-5 text-success-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
              </div>

              <div className="space-y-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {download.platform === 'macOS' && 'Native macOS installer with GUI wizard and system integration'}
                  {download.platform === 'Linux DEB' && 'Debian/Ubuntu package with systemd service support'}
                  {download.platform === 'Linux RPM' && 'RHEL/Fedora package with systemd service support'}
                  {download.platform === 'Windows' && 'Windows MSI installer with service integration'}
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(download)}
                    disabled={download.status === 'coming-soon' || !download.url}
                    className="flex-1 rounded-2xl"
                    variant={download.status === 'available' ? 'default' : 'outline'}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {download.status === 'available' ? 'Download' : 'Coming Soon'}
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => setSelectedPlatform(selectedPlatform === download.platform ? null : download.platform)}
                  >
                    Instructions
                  </Button>
                </div>

                {/* Instructions */}
                <AnimatePresence>
                  {selectedPlatform === download.platform && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700"
                    >
                      <h4 className="font-medium mb-2 text-slate-900 dark:text-white">Installation Instructions:</h4>
                      <ol className="text-xs space-y-2 list-decimal list-inside text-slate-600 dark:text-slate-300">
                        {download.instructions.map((instruction, idx) => (
                          <li key={idx}>{instruction}</li>
                        ))}
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Links */}
      <motion.div
        variants={slideUpVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.7 }}
        className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-white/5"
      >
        <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">Direct Access</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Packages</h4>
            <div className="grid grid-cols-1 gap-2">
              {releaseInfo && Object.entries(releaseInfo.platforms).filter(([_, info]) => info.available).map(([key, info]) => (
                <a
                  key={key}
                  href={info.downloadUrl}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{info.displayName}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{info.fileSize || 'Latest'}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Documentation</h4>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Installation Guide', href: '/docs/agent-installation', icon: <Download className="w-3 h-3" /> },
                { label: 'Configuration Guide', href: '/docs/agent-configuration', icon: <Monitor className="w-3 h-3" /> },
                { label: 'Troubleshooting', href: '/docs/troubleshooting', icon: <AlertCircle className="w-3 h-3" /> }
              ].map((link, idx) => (
                <a
                  key={idx}
                  href={link.href}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-black/20 border border-slate-100 dark:border-white/5 hover:border-primary/30 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-white">{link.label}</div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Support */}
      <motion.div
        variants={slideUpVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.8 }}
        className="text-center space-y-4 pt-4"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Need support?</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-lg mx-auto">
          Check our documentation or contact support for assistance with agent installation and configuration.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" className="rounded-3xl" onClick={() => window.open('/docs/agent-installation', '_blank')}>
            Documentation
          </Button>
          <Button className="rounded-3xl" onClick={() => window.open('mailto:support@sentinel-grc.com', '_blank')}>
            Contact Support
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default AgentDownloads;

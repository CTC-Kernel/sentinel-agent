import React, { useState } from 'react';
import { Shield, Download, Apple, Monitor, Package, CheckCircle, AlertCircle } from '../ui/Icons';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/Badge';
import { motion } from 'framer-motion';
import { slideUpVariants } from '../ui/animationVariants';

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

  const downloads: AgentDownload[] = [
    {
      platform: 'macOS',
      version: '2.0.0',
      size: '24MB',
      url: '/downloads/agents/SentinelAgent-2.0.0.pkg',
      status: 'available',
      icon: <Apple className="w-8 h-8" />,
      instructions: [
        'APPLE SILICON & INTEL (pkg)',
        'STABLE RELEASE',
        'Download the SentinelAgent-latest.pkg file',
        'Double-click the package to open the installer',
        'Follow the installation wizard steps'
      ]
    },
    {
      platform: 'Windows',
      version: '2.0.0',
      size: '8.5MB',
      url: '/releases/agent/SentinelAgentSetup-2.0.0.msi',
      status: 'available',
      icon: <Monitor className="w-8 h-8" />,
      instructions: [
        'INSTALLATEUR .MSI',
        'Download the SentinelAgentSetup-latest.msi file',
        'Run the installer as Administrator',
        'Follow the installation wizard',
        'Launch from Start Menu'
      ]
    },
    {
      platform: 'Linux DEB',
      version: '2.0.0',
      size: '9.3MB',
      url: '/releases/agent/linux_deb/sentinel-agent_2.0.0_arm64.deb',
      status: 'available',
      icon: <Package className="w-8 h-8" />,
      instructions: [
        'DEBIAN / UBUNTU (arm64)',
        'Download the .deb package',
        'Install: sudo dpkg -i sentinel-agent_latest_arm64.deb',
        'Start: sudo systemctl start sentinel-agent'
      ]
    },
    {
      platform: 'Linux RPM',
      version: '2.0.0',
      size: '9.3MB',
      url: '/releases/agent/linux_rpm/sentinel-agent-2.0.0.x86_64.rpm',
      status: 'available',
      icon: <Package className="w-8 h-8" />,
      instructions: [
        'RHEL / FEDORA',
        'Download the .rpm package',
        'Install: sudo rpm -i sentinel-agent-latest.x86_64.rpm',
        'Start: sudo systemctl start sentinel-agent'
      ]
    }
  ];

  const handleDownload = (download: AgentDownload) => {
    if (download.status === 'available') {
      window.open(download.url, '_blank');
    }
  };

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
          className="text-4xl font-bold tracking-tight"
        >
          Sentinel GRC Agent Downloads
        </motion.h1>

        <motion.p
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          className="text-xl text-muted-foreground max-w-2xl mx-auto"
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
            <Card className="p-6 hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {download.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{download.platform}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">v{download.version}</span>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{download.size}</span>
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
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-warning" />
                )}
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {download.platform === 'macOS' && 'Native macOS installer with GUI wizard and system integration'}
                  {download.platform === 'Linux' && 'Command-line installer with systemd service support'}
                  {download.platform === 'Windows' && 'Windows MSI installer with service integration'}
                  {download.platform === 'Android' && 'Mobile app with real-time monitoring and notifications'}
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(download)}
                    disabled={download.status === 'coming-soon'}
                    className="flex-1"
                    variant={download.status === 'available' ? 'default' : 'outline'}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {download.status === 'available' ? 'Download' : 'Coming Soon'}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setSelectedPlatform(selectedPlatform === download.platform ? null : download.platform)}
                  >
                    Instructions
                  </Button>
                </div>

                {/* Instructions */}
                {selectedPlatform === download.platform && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 bg-muted/50 rounded-lg"
                  >
                    <h4 className="font-medium mb-2">Installation Instructions:</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside">
                      {download.instructions.map((instruction, idx) => (
                        <li key={idx} className="text-muted-foreground">{instruction}</li>
                      ))}
                    </ol>
                  </motion.div>
                )}
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
        className="bg-muted/50 rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">Direct Downloads</h4>
            <div className="space-y-1 text-sm">
              <a href="/downloads/agents/SentinelAgent-2.0.0.pkg" className="text-primary hover:underline block">
                🍎 macOS (.pkg) - 24MB
              </a>
              <a href="/releases/agent/SentinelAgentSetup-2.0.0.msi" className="text-primary hover:underline block">
                🪟 Windows (.msi) - 8.5MB
              </a>
              <a href="/releases/agent/linux_deb/sentinel-agent_2.0.0_arm64.deb" className="text-primary hover:underline block">
                🐧 Linux DEB (.deb) - 9.3MB
              </a>
              <a href="/releases/agent/linux_rpm/sentinel-agent-2.0.0.x86_64.rpm" className="text-primary hover:underline block">
                🐧 Linux RPM (.rpm) - 9.3MB
              </a>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Documentation</h4>
            <div className="space-y-1 text-sm">
              <a href="/docs/agent-installation" className="text-primary hover:underline block">
                📖 Installation Guide
              </a>
              <a href="/docs/agent-configuration" className="text-primary hover:underline block">
                ⚙️ Configuration
              </a>
              <a href="/docs/troubleshooting" className="text-primary hover:underline block">
                🔧 Troubleshooting
              </a>
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
        className="text-center space-y-4"
      >
        <h3 className="text-lg font-semibold">Need Help?</h3>
        <p className="text-muted-foreground">
          Check our documentation or contact support for assistance with agent installation and configuration.
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={() => window.open('/docs/agent-installation', '_blank')}>
            Documentation
          </Button>
          <Button onClick={() => window.open('mailto:support@sentinel-grc.com', '_blank')}>
            Contact Support
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default AgentDownloads;

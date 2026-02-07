import React from 'react';
import { Badge } from '../ui/Badge';
import { Shield, Users, Activity } from '../ui/Icons';

const OFFICIAL_SOURCES = new Set([
  'CISA', 'ANSSI', 'FBI', 'Europol', 'NCSC-UK', 'BSI', 'CERT-FR', 'ICS-CERT', 'CISA KEV',
]);

const CERT_SOURCES = new Set([
  'JPCERT', 'CERT-AU', 'CERT-BR', 'CCCS', 'KrCERT',
]);

const AUTOMATED_SOURCES = new Set(['URLhaus']);

interface SourceBadgeProps {
  source?: string;
  className?: string;
}

export const SourceBadge: React.FC<SourceBadgeProps> = React.memo(({ source, className }) => {
  if (!source) return null;

  if (OFFICIAL_SOURCES.has(source)) {
    return (
      <Badge status="info" variant="soft" icon={Shield} className={className}>
        {source}
      </Badge>
    );
  }

  if (CERT_SOURCES.has(source)) {
    return (
      <Badge status="info" variant="outline" className={className}>
        {source}
      </Badge>
    );
  }

  if (AUTOMATED_SOURCES.has(source)) {
    return (
      <Badge status="warning" variant="outline" icon={Activity} className={className}>
        {source}
      </Badge>
    );
  }

  // Community / unknown
  return (
    <Badge status="neutral" variant="soft" icon={Users} className={className}>
      {source}
    </Badge>
  );
});

SourceBadge.displayName = 'SourceBadge';

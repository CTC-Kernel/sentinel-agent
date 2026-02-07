import React, { useState, useMemo } from 'react';
import { InspectorLayout } from '../ui/InspectorLayout';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/button';
import { DiscussionPanel } from '../collaboration/DiscussionPanel';
import { SourceBadge } from './SourceBadge';
import {
  AlertOctagon, Globe, Users, ThumbsUp, MessageSquare, CheckCircle,
  ExternalLink, Shield, FileText, Link2,
} from '../ui/Icons';
import { useStore } from '@/store';
import type { Threat } from '@/types/risks';

interface ThreatDetailPanelProps {
  isOpen: boolean;
  onClose: () => void;
  threat: Threat | null;
  threats: Threat[];
  onConfirmSighting: (id: string) => void;
  onDownloadRule: (e: React.MouseEvent, t: Threat) => void;
  onCreateRisk: (t: Threat) => void;
}

const severityBadgeStatus = (severity: string): 'error' | 'warning' | 'info' | 'neutral' => {
  if (severity === 'Critical') return 'error';
  if (severity === 'High') return 'warning';
  if (severity === 'Medium') return 'info';
  return 'neutral';
};

const tabs = [
  { id: 'details', label: 'Détails', icon: FileText },
  { id: 'discussion', label: 'Discussion', icon: MessageSquare },
  { id: 'related', label: 'Liées', icon: Link2 },
];

export const ThreatDetailPanel: React.FC<ThreatDetailPanelProps> = ({
  isOpen,
  onClose,
  threat,
  threats,
  onConfirmSighting,
  onDownloadRule,
  onCreateRisk,
}) => {
  const { t } = useStore();
  const [activeTab, setActiveTab] = useState('details');

  const relatedThreats = useMemo(() => {
    if (!threat) return [];
    return threats
      .filter(rt =>
        rt.id !== threat.id &&
        (rt.type === threat.type || rt.source === threat.source)
      )
      .slice(0, 8);
  }, [threat, threats]);

  if (!threat) return null;

  return (
    <InspectorLayout
      isOpen={isOpen}
      onClose={onClose}
      width="max-w-4xl"
      icon={AlertOctagon}
      title={threat.title}
      subtitle={
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <Globe className="h-3.5 w-3.5" /> {threat.country}
          <span className="mx-1">·</span>
          <Users className="h-3.5 w-3.5" /> {threat.author}
          <span className="mx-1">·</span>
          <span className="font-mono text-xs">{threat.date}</span>
        </div>
      }
      statusBadge={
        <div className="flex items-center gap-2">
          {threat.verified && (
            <Badge status="success" variant="soft" icon={CheckCircle}>
              {t('common.verified', { defaultValue: 'Vérifié' })}
            </Badge>
          )}
          <Badge status={severityBadgeStatus(threat.severity)} variant="soft">
            {threat.severity}
          </Badge>
          <SourceBadge source={threat.source} />
        </div>
      }
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabsAriaLabel="Threat detail tabs"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            aria-label="Confirm sighting"
            onClick={() => onConfirmSighting(threat.id)}
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary"
          >
            <ThumbsUp className="h-4 w-4 mr-1.5" /> {threat.votes}
          </Button>
          <Button
            aria-label="Download SIGMA rule"
            onClick={(e) => onDownloadRule(e, threat)}
            className="text-xs font-bold text-success-text px-3 py-1.5 h-auto bg-success-bg rounded-lg hover:bg-success-bg/80"
          >
            SIGMA
          </Button>
          <Button
            aria-label="Create risk"
            onClick={(e) => { e.stopPropagation(); onCreateRisk(threat); }}
            className="text-xs font-bold text-warning-text px-3 py-1.5 h-auto bg-warning-bg rounded-lg hover:bg-warning-bg/80"
          >
            {t('threats.createRisk', { defaultValue: 'Risque' })}
          </Button>
        </div>
      }
    >
      {activeTab === 'details' && (
        <div className="space-y-8">
          {/* Description */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider">
              {t('common.description', { defaultValue: 'Description' })}
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {threat.description || t('threatIntel.detail.noDescription', { defaultValue: 'Aucune description disponible.' })}
            </p>
          </section>

          {/* IOCs */}
          {threat.iocs && (
            <section>
              <h4 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-4 w-4 text-error-text" /> IOCs
              </h4>
              <pre className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap border border-border/40">
                {threat.iocs}
              </pre>
            </section>
          )}

          {/* Metadata grid */}
          <section className="grid grid-cols-2 gap-4">
            <MetadataItem label={t('common.type', { defaultValue: 'Type' })} value={threat.type} />
            <MetadataItem label={t('common.severity', { defaultValue: 'Sévérité' })} value={threat.severity} />
            <MetadataItem label={t('common.source', { defaultValue: 'Source' })} value={threat.source || 'Community'} />
            <MetadataItem label={t('common.status', { defaultValue: 'Statut' })} value={threat.status || 'Active'} />
            <MetadataItem label="Confirmations" value={String(threat.votes)} />
            <MetadataItem label="Discussions" value={String(threat.comments || 0)} />
          </section>

          {/* External link */}
          {threat.url && (
            <a
              href={threat.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              {t('threatIntel.detail.viewSource', { defaultValue: 'Voir la source originale' })}
            </a>
          )}
        </div>
      )}

      {activeTab === 'discussion' && (
        <DiscussionPanel
          collectionName="threats"
          documentId={threat.id}
          title={threat.title}
          showHeader={false}
          enableSearch
          enableFilters
          enableExport
          enableNotifications
          maxHeight="calc(100vh - 300px)"
        />
      )}

      {activeTab === 'related' && (
        <div className="space-y-3">
          {relatedThreats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {t('threatIntel.detail.noRelated', { defaultValue: 'Aucune menace liée trouvée.' })}
            </div>
          ) : (
            relatedThreats.map((rt) => (
              <div
                key={rt.id}
                className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/40 hover:border-primary/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`p-2 rounded-xl shrink-0 ${rt.type === 'Ransomware' ? 'bg-error-bg text-error-text' : 'bg-primary/10 text-primary'}`}>
                    <AlertOctagon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-sm font-semibold text-foreground truncate">{rt.title}</h5>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{rt.country}</span>
                      <span>·</span>
                      <span>{rt.date}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <SourceBadge source={rt.source} />
                  <Badge status={severityBadgeStatus(rt.severity)} variant="soft" size="sm">
                    {rt.severity}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </InspectorLayout>
  );
};

const MetadataItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-muted/30 rounded-xl p-3 border border-border/40">
    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
    <div className="text-sm font-semibold text-foreground">{value}</div>
  </div>
);

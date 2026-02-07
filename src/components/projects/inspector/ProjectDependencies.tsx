import React, { useState, useCallback, useMemo} from 'react';
import { Risk, Control, Asset, Audit, Project, UserProfile, Supplier, BusinessProcess } from '../../../types';
import { Badge } from '../../ui/Badge';
import { ShieldAlert, CheckSquare, Server, ClipboardCheck, Edit } from '../../ui/Icons';
import { RiskInspector } from '../../risks/RiskInspector';
import { AssetInspector } from '../../assets/AssetInspector';
import { AuditInspector } from '../../audits/AuditInspector';
import { ComplianceInspector } from '../../compliance/ComplianceInspector';
import { RISK_ACCEPTANCE_THRESHOLD } from '../../../constants/RiskConstants';
import { RISK_THRESHOLDS } from '../../../constants/complianceConfig';

type DependencyType = 'risks' | 'controls' | 'assets' | 'audits';

interface ProjectDependenciesProps {
 type: DependencyType;
 items: (Risk | Control | Asset | Audit)[];
 // Context props for Inspectors
 project?: Project;
 usersList?: UserProfile[];
 assets?: Asset[];
 controls?: Control[];
 audits?: Audit[];
 risks?: Risk[];
 suppliers?: Supplier[];
 processes?: BusinessProcess[];
 canEdit: boolean;
}

export const ProjectDependencies: React.FC<ProjectDependenciesProps> = ({
 type, items, project, usersList = [], assets = [], controls = [], audits = [], risks = [], suppliers = [], processes = [], canEdit
}) => {
 const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
 const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
 const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);
 const [selectedControl, setSelectedControl] = useState<Control | null>(null);

 // Empty State Helpers
 const getEmptyState = () => {
 switch (type) {
 case 'risks':
 return { icon: ShieldAlert, text: 'Aucun risque lié à ce projet.' };
 case 'controls':
 return { icon: CheckSquare, text: 'Aucun contrôle lié à ce projet.' };
 case 'assets':
 return { icon: Server, text: 'Aucun actif lié à ce projet.' };
 case 'audits':
 return { icon: ClipboardCheck, text: 'Aucun audit lié à ce projet.' };
 }
 };

 if (items.length === 0) {
 const { icon: Icon, text } = getEmptyState();

  // Extracted callbacks (useCallback)
  const handleClose = useCallback(() => {
    setSelectedRisk(null)
  }, []);

  const handleDelete = useCallback(() => {
    { }
  }, []);

  const handleDuplicate = useCallback(() => {
    { }
  }, []);

  const handleClose2 = useCallback(() => {
    setSelectedAsset(null)
  }, []);

  const handleDelete2 = useCallback(() => {
    { }
  }, []);

  const handleClose3 = useCallback(() => {
    setSelectedAudit(null)
  }, []);

  const handleDelete3 = useCallback(() => {
    { }
  }, []);

  const handleRefreshAudits = useCallback(() => {
    { }
  }, []);

  const handleClick = useCallback(() => {
    setSelectedRisk(risk)
  }, []);

  const handleClick2 = useCallback(() => {
    setSelectedControl(control)
  }, []);

  const handleClick3 = useCallback(() => {
    setSelectedAsset(asset)
  }, []);

  const handleClick4 = useCallback(() => {
    setSelectedAudit(audit)
  }, []);


 return (
 <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
 <Icon className="h-12 w-12 mb-2 opacity-60" />
 <p>{text}</p>
 </div>
 );
 }

 // Render Items
 return (
 <div className="space-y-4">
 {items.map(item => {
 switch (type) {
  case 'risks': {
  const risk = item as Risk;
  return (
  <LinkedRiskItem
  key={risk.id || 'unknown'}
  risk={risk}
  onClick={handleClick}
  />
  );
  }

  case 'controls': {
  const control = item as Control;
  return (
  <div key={control.id || 'unknown'} className="cursor-pointer transition-colors hover:bg-muted/50 dark:hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded" onClick={handleClick2} onKeyDown={(e) => e.key === 'Enter' && setSelectedControl(control)} role="button" tabIndex={0} aria-label={`Voir le contrôle ${control.name}`}>
  <LinkedControlItem control={control} />
  </div>
  );
  }

  case 'assets': {
  const asset = item as Asset;
  return (
  <LinkedAssetItem
  key={asset.id || 'unknown'}
  asset={asset}
  onClick={handleClick3}
  />
  );
  }

  case 'audits': {
  const audit = item as Audit;
  return (
  <LinkedAuditItem
  key={audit.id || 'unknown'}
  audit={audit}
  onClick={handleClick4}
  />
  );
  }

  default: return null;
 }
 })}

 {/* Embedded Inspectors */}
 {selectedRisk && (
 <RiskInspector
  isOpen={!!selectedRisk}
  onClose={handleClose}
  risk={selectedRisk}
  assets={assets}
  controls={controls}
  projects={project ? [project] : []} // Or all projects if available? Usually RiskInspector needs all to link
  audits={audits}
  suppliers={suppliers}
  usersList={usersList}
  processes={processes}
  canEdit={canEdit}
  demoMode={false}
  onUpdate={async () => true} // Start with true/dummy
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
 />
 )}

 {selectedAsset && (
 <AssetInspector
  isOpen={!!selectedAsset}
  onClose={handleClose2}
  selectedAsset={selectedAsset}
  users={usersList}
  suppliers={suppliers}
  processes={processes}
  canEdit={canEdit}
  onUpdate={async () => true}
  onCreate={async () => true}
  onDelete={handleDelete2}
 />
 )}

 {selectedAudit && (
 <AuditInspector
  onClose={handleClose3}
  audit={selectedAudit}
  canEdit={canEdit}
  usersList={usersList}
  onDelete={handleDelete3}
  controls={controls}
  documents={[]} // Documents default
  assets={assets}
  risks={risks}
  projects={project ? [project] : []}
  refreshAudits={handleRefreshAudits} // Dummy refresh
 />
 )}

 {selectedControl && (
 <ComplianceInspector
  control={selectedControl}
  canEdit={canEdit}
  usersList={usersList}
  assets={assets}
  suppliers={suppliers}
  documents={[]} // Documents not passed yet, might need empty array
  risks={risks}
  projects={project ? [project] : []}
  findings={[]} // Findings not passed
  handlers={{
  updating: false,
  handleStatusChange: async () => { },
  handleAssign: async () => { },
  handleLinkAsset: async () => { },
  handleUnlinkAsset: async () => { },
  handleLinkSupplier: async () => { },
  handleUnlinkSupplier: async () => { },
  handleLinkProject: async () => { },
  handleUnlinkProject: async () => { },
  handleLinkDocument: async () => { },
  handleUnlinkDocument: async () => { },
  updateJustification: async () => { },
  onUploadEvidence: () => { }
  }}
 />
 )}
 </div>
 );
};

// Helper Components (Keep existing or redefine if they were missing imports)
const LinkedControlItem = ({ control }: { control: Control }) => (
 <div className="glass-premium p-4 rounded-3xl border border-border/40 flex justify-between items-center bg-white/40 dark:bg-white/5">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <span className="text-xs font-mono text-muted-foreground">{control.code}</span>
 <h4 className="font-bold text-foreground">{control.name}</h4>
 </div>
 <p className="text-sm text-muted-foreground line-clamp-2">{control.description}</p>
 </div>
 </div>
);



/* --- Internal Components for List Items --- */

const LinkedRiskItem = React.memo(({ risk, onClick }: { risk: Risk, onClick: () => void }) => {
 const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onClick();
 }
 }, [onClick]);

 return (
 <div
 onClick={onClick}
 onKeyDown={handleKeyDown}
 role="button"
 tabIndex={0}
 className="cursor-pointer glass-premium p-4 rounded-3xl border border-border/40 flex justify-between items-center group hover:bg-muted/500 dark:hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 <div>
 <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{risk.threat}</h4>
 <div className="flex items-center gap-2 mt-1">
  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${risk.score >= RISK_ACCEPTANCE_THRESHOLD ? 'bg-red-100 text-red-600' : risk.score >= RISK_THRESHOLDS.MEDIUM ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>Score: {risk.score}</span>
  <span className="text-xs text-muted-foreground">{risk.category}</span>
 </div>
 </div>
 <div className="opacity-0 group-hover:opacity-70 transition-opacity">
 <Edit className="h-4 w-4 text-muted-foreground" />
 </div>
 </div>
 );
});

const LinkedAssetItem = React.memo(({ asset, onClick }: { asset: Asset, onClick: () => void }) => {
 const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onClick();
 }
 }, [onClick]);

 return (
 <div
 onClick={onClick}
 onKeyDown={handleKeyDown}
 role="button"
 tabIndex={0}
 className="cursor-pointer glass-premium p-4 rounded-3xl border border-border/40 flex items-center gap-4 group hover:bg-muted/500 dark:hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0">
 <Server className="h-5 w-5" />
 </div>
 <div>
 <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{asset.name}</h4>
 <span className="text-xs text-muted-foreground">{asset.type}</span>
 </div>
 </div>
 );
});

const LinkedAuditItem = React.memo(({ audit, onClick }: { audit: Audit, onClick: () => void }) => {
 const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 onClick();
 }
 }, [onClick]);

 return (
 <div
 onClick={onClick}
 onKeyDown={handleKeyDown}
 role="button"
 tabIndex={0}
 className="cursor-pointer glass-premium p-4 rounded-3xl border border-border/40 bg-white/40 dark:bg-white/5 hover:bg-white/60 dark:hover:bg-muted transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
 >
 <div className="flex justify-between items-start">
 <div>
  <h4 className="font-bold text-foreground group-hover:text-primary transition-colors">{audit.name}</h4>
  <p className="text-xs text-muted-foreground mt-1">Ref: {audit.reference}</p>
 </div>
 <Badge status={audit.status === 'Validé' || audit.status === 'Terminé' ? 'success' : 'warning'}>{audit.status}</Badge>
 </div>
 </div>
 );
});

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Document } from '../../types';
import { FileText, CheckCircle2, Clock, ArrowRight } from '../ui/Icons';
import { motion } from 'framer-motion';
import { useLocale } from '../../hooks/useLocale';

interface ApprovalsWidgetProps {
 documents: Document[];
}

export const ApprovalsWidget: React.FC<ApprovalsWidgetProps> = ({ documents }) => {
 const { user } = useStore();
 const { t } = useLocale();
 const navigate = useNavigate();

 const pendingApprovals = documents.filter(doc =>
 doc.status === 'En revue' &&
 doc.reviewers?.includes(user?.uid || '') &&
 !doc.approvers?.includes(user?.uid || '')
 );

 const handleDocumentClick = useCallback((docId: string) => {
 navigate('/documents', { state: { voxelSelectedId: docId, voxelSelectedType: 'document' } });
 }, [navigate]);

 const handleKeyDown = useCallback((e: React.KeyboardEvent, docId: string) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 navigate('/documents', { state: { voxelSelectedId: docId, voxelSelectedType: 'document' } });
 }
 }, [navigate]);

 if (pendingApprovals.length === 0) return null;

 return (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="bg-gradient-to-br from-warning/10 to-warning/5 dark:from-warning/20 dark:to-warning/5 rounded-3xl p-6 border border-warning/20"
 >
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded-2xl bg-warning/10 text-warning flex items-center justify-center">
  <CheckCircle2 className="h-5 w-5" />
  </div>
  <div>
  <h3 className="text-lg font-bold text-foreground">{t('dashboard.approvals', { defaultValue: 'Approbations' })}</h3>
  <p className="text-xs font-medium text-warning dark:text-warning">{t('dashboard.documentsToReview', { defaultValue: '{{count}} document(s) à revoir', count: pendingApprovals.length })}</p>
  </div>
 </div>
 <button
  onClick={() => navigate('/documents')}
  className="p-2.5 hover:bg-muted/500 dark:hover:bg-black/10 rounded-3xl transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-warning/50"
 >
  <ArrowRight className="h-5 w-5" />
 </button>
 </div>

 <div className="space-y-3">
 {pendingApprovals.slice(0, 3).map(doc => (
  <div
  key={doc.id || 'unknown'}
  onClick={() => handleDocumentClick(doc.id)}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => handleKeyDown(e, doc.id)}
  className="bg-background/80 p-3 rounded-3xl border border-warning/20 cursor-pointer hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-warning/50"
  >
  <div className="flex items-center justify-between">
  <div className="flex items-center gap-3 min-w-0">
  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
  <span className="text-sm font-bold text-foreground truncate">{doc.title}</span>
  </div>
  <span className="text-[11px] font-bold px-2 py-1 bg-warning/10 text-warning dark:text-warning rounded-lg whitespace-nowrap">
  v{doc.version}
  </span>
  </div>
  <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
  <Clock className="h-3 w-3" />
  <span>{t('dashboard.waitingSince', { defaultValue: 'En attente depuis {{date}}', date: new Date(doc.updatedAt).toLocaleDateString() })}</span>
  </div>
  </div>
 ))}
 </div>
 </motion.div>
 );
};

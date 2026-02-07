
import React from 'react';
import { ImportGuidelinesModal } from '../ui/ImportGuidelinesModal';
import { ImportService } from '../../services/ImportService';
import { useStore } from '../../store';

interface RiskImportModalProps {
 isOpen: boolean;
 onClose: () => void;
 importRisks: (data: string) => Promise<boolean>;
}

export const RiskImportModal: React.FC<RiskImportModalProps> = ({ isOpen, onClose, importRisks }) => {
 const { t } = useStore();

 const handleImportFile = async (file: File) => {
 const text = await file.text();
 const success = await importRisks(text);
 if (success) onClose();
 };

  // Keyboard support: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);


 return (
 <ImportGuidelinesModal
 isOpen={isOpen}
 onClose={onClose}
 entityName={t('risks.title')}
 guidelines={{
 required: ['menace', 'probabilite', 'gravite', 'strategie'],
 optional: ['description', 'vulnerabilite', 'statut', 'proprietaire'],
 format: 'CSV'
 }}
 onImport={handleImportFile}
 onDownloadTemplate={() => ImportService.downloadRiskTemplate()}
 />
 );
};

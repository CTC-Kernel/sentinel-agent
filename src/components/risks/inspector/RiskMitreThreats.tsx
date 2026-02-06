import React from 'react';
import { MitreTechnique, Risk } from '../../../types';

interface RiskMitreThreatsProps {
 risk: Risk;
 mitreQuery: string;
 mitreResults: MitreTechnique[];
 onMitreQueryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
 onMitreSearch: () => void;
 onMitreAdd: (t: MitreTechnique) => void;
}

export const RiskMitreThreats: React.FC<RiskMitreThreatsProps> = ({
 risk,
 mitreQuery,
 mitreResults,
 onMitreQueryChange,
 onMitreSearch,
 onMitreAdd
}) => {
 return (
 <div className="space-y-6">
 <div className="space-y-4">
 <h3 className="text-lg font-bold">MITRE ATT&CK</h3>
 <div className="flex gap-2">
  <input value={mitreQuery} onChange={onMitreQueryChange}
  className="flex-1 px-4 py-2 border rounded-3xl"
  placeholder="Rechercher une technique..."
  aria-label="Rechercher une technique MITRE ATT&CK"
  />
  <button
  aria-label="Rechercher"
  className="px-4 py-2 bg-card text-white rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  onClick={onMitreSearch}
  >
  Chercher
  </button>
 </div>
 <div className="space-y-2">
  {mitreResults.map(t => (
  <div key={t.id || 'unknown'} className="flex justify-between p-2 border rounded-lg">
  <span>{t.name}</span>
  <button aria-label="Ajouter la technique" onClick={() => onMitreAdd(t)}>Ajouter</button>
  </div>
  ))}
 </div>
 </div>

 {/* Display current techniques if needed, or rely on risk display elsewhere */}
 {risk.mitreTechniques && risk.mitreTechniques.length > 0 && (
 <div className="space-y-2 mt-4">
  <h4 className="text-sm font-bold">Techniques Liées</h4>
  {risk.mitreTechniques.map((t, idx) => (
  <div key={`${t.id || 'unknown'}-${idx}`} className="text-sm p-2 bg-muted rounded">
  {t.name} ({t.id})
  </div>
  ))}
 </div>
 )}
 </div>
 );
};

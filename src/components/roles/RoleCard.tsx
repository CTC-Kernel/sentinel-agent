import React from 'react';
import { Role, getRoleName, getRoleDescription } from '../../utils/permissions';

interface RoleCardProps {
 role: Role;
 count: number;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, count }) => {
 return (
 <div 
 className="glass-premium p-4 rounded-2xl border border-border/40"
 role="article"
 aria-label={`Rôle: ${getRoleName(role)}`}
 >
 <div className="flex items-start justify-between mb-2">
 <h3 className="text-sm font-bold text-foreground">
  {getRoleName(role)}
 </h3>
 <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs font-bold">
  {count}
 </span>
 </div>
 <p className="text-xs text-muted-foreground leading-relaxed">
 {getRoleDescription(role)}
 </p>
 </div>
 );
};

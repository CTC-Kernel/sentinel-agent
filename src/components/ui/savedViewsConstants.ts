import { ShieldAlert, Zap, Star } from './Icons';
import React from 'react';

/**
 * Filter configuration for saved views
 * Supports nullable arrays for multi-select filters
 */
export interface SavedViewFilters {
    status: string[] | null;
    category: string[] | null;
    criticality: string[] | null;
}

export interface SavedView {
    id: string;
    name: string;
    icon?: React.ComponentType<{ className?: string }>;
    filters: SavedViewFilters;
}

export const DEFAULT_VIEWS: SavedView[] = [
    { id: 'all', name: 'Tous les risques', icon: ShieldAlert, filters: { status: null, category: null, criticality: null } },
    { id: 'critical', name: 'Critiques uniquement', icon: Zap, filters: { status: null, category: null, criticality: ['Critique'] } },
    { id: 'my-risks', name: 'Mes Risques', icon: Star, filters: { status: ['En cours'], category: null, criticality: null } },
];

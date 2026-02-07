/**
 * Epic 33: Story 33.2 - Annotation Creation UI
 *
 * A floating panel for creating and editing annotations in the Voxel scene.
 * Features:
 * - Click on 3D space to place annotation
 * - Rich text content editor
 * - Type/color/visibility selectors
 * - Drag to reposition
 * - Keyboard shortcut (A) to start annotation mode
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 X,
 StickyNote,
 HelpCircle,
 AlertTriangle,
 Highlighter,
 Globe,
 Lock,
 Users,
 Paperclip,
 Check,
 GripVertical,
} from '../ui/Icons';
import type {
 Position3D,
 AnnotationType,
 AnnotationVisibility,
 CreateAnnotationDTO,
 UpdateAnnotationDTO,
 VoxelAnnotation,
 AnnotationAuthor,
} from '../../types/voxelAnnotation';
import {
 ANNOTATION_TYPE_COLORS,
 ANNOTATION_TYPE_LABELS,
 ANNOTATION_VISIBILITY_LABELS,
} from '../../types/voxelAnnotation';
import { AnnotationService } from '../../services/annotationService';
import { useAuth } from '../../hooks/useAuth';
import { VOXEL_ANNOTATION_COLORS, hexToString } from './voxelTheme';
import { ErrorLogger } from '../../services/errorLogger';

// ============================================================================
// Types
// ============================================================================

interface AnnotationCreatorProps {
 /** Whether the creator is visible */
 isOpen: boolean;

 /** Callback when creator is closed */
 onClose: () => void;

 /** Organization ID */
 organizationId: string;

 /** Position in 3D space (required for new annotations) */
 position?: Position3D;

 /** Node ID to attach annotation to (optional) */
 nodeId?: string;

 /** Existing annotation for editing */
 editingAnnotation?: VoxelAnnotation;

 /** Callback after successful save */
 onSave?: (annotation: VoxelAnnotation) => void;

 /** Panel offset position (for dragging) */
 initialOffset?: { x: number; y: number };
}

// ============================================================================
// Constants
// ============================================================================

const TYPE_OPTIONS: { value: AnnotationType; icon: React.ReactNode; label: string }[] = [
 { value: 'note', icon: <StickyNote className="w-4 h-4" />, label: ANNOTATION_TYPE_LABELS.note },
 { value: 'question', icon: <HelpCircle className="w-4 h-4" />, label: ANNOTATION_TYPE_LABELS.question },
 { value: 'issue', icon: <AlertTriangle className="w-4 h-4" />, label: ANNOTATION_TYPE_LABELS.issue },
 { value: 'highlight', icon: <Highlighter className="w-4 h-4" />, label: ANNOTATION_TYPE_LABELS.highlight },
];

const VISIBILITY_OPTIONS: { value: AnnotationVisibility; icon: React.ReactNode; label: string }[] = [
 { value: 'public', icon: <Globe className="w-4 h-4" />, label: ANNOTATION_VISIBILITY_LABELS.public },
 { value: 'private', icon: <Lock className="w-4 h-4" />, label: ANNOTATION_VISIBILITY_LABELS.private },
 { value: 'team', icon: <Users className="w-4 h-4" />, label: ANNOTATION_VISIBILITY_LABELS.team },
];

// Use theme-defined annotation colors
const COLOR_PRESETS = VOXEL_ANNOTATION_COLORS.map(c => hexToString(c.hex));

// ============================================================================
// Component
// ============================================================================

export const AnnotationCreator: React.FC<AnnotationCreatorProps> = ({
 isOpen,
 onClose,
 organizationId,
 position,
 nodeId,
 editingAnnotation,
 onSave,
 initialOffset = { x: 0, y: 0 },
}) => {
 const { user } = useAuth();

 // Form state
 const [content, setContent] = useState('');
 const [type, setType] = useState<AnnotationType>('note');
 const [color, setColor] = useState(ANNOTATION_TYPE_COLORS.note);
 const [visibility, setVisibility] = useState<AnnotationVisibility>('public');
 const [teamId, setTeamId] = useState<string>('');

 // UI state
 const [isSaving, setIsSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [panelOffset, setPanelOffset] = useState(initialOffset);
 // const [isDragging, setIsDragging] = useState(false);

 // Initialize form with editing annotation data
 useEffect(() => {
 if (editingAnnotation) {
 setContent(editingAnnotation.content);
 setType(editingAnnotation.type);
 setColor(editingAnnotation.color);
 setVisibility(editingAnnotation.visibility);
 setTeamId(editingAnnotation.teamId || '');
 } else {
 // Reset form for new annotation
 setContent('');
 setType('note');
 setColor(ANNOTATION_TYPE_COLORS.note);
 setVisibility('public');
 setTeamId('');
 }
 }, [editingAnnotation, isOpen]);

 // Update color when type changes (only for new annotations)
 useEffect(() => {
 if (!editingAnnotation) {
 setColor(ANNOTATION_TYPE_COLORS[type]);
 }
 }, [type, editingAnnotation]);

 // Create author object from current user
 const author = useMemo<AnnotationAuthor | null>(() => {
 if (!user) return null;
 return {
 id: user.uid,
 displayName: user.displayName || user.email || 'Anonymous',
 email: user.email || undefined,
 avatarUrl: user.photoURL || undefined,
 };
 }, [user]);

 // Handle save
 const handleSave = useCallback(async () => {
 if (!content.trim()) {
 setError('Content is required');
 return;
 }

 if (!author) {
 setError('You must be logged in');
 return;
 }

 if (!editingAnnotation && !position) {
 setError('Position is required for a new annotation');
 return;
 }

 setIsSaving(true);
 setError(null);

 try {
 let savedAnnotation: VoxelAnnotation | null;

 if (editingAnnotation) {
 // Update existing annotation
 const dto: UpdateAnnotationDTO = {
 content,
 type,
 color,
 visibility,
 teamId: visibility === 'team' ? teamId : undefined,
 };

 savedAnnotation = await AnnotationService.updateAnnotation(
 editingAnnotation.id,
 dto,
 author
 );
 } else {
 // Create new annotation
 const dto: CreateAnnotationDTO = {
 nodeId,
 position: position!,
 content,
 type,
 color,
 visibility,
 teamId: visibility === 'team' ? teamId : undefined,
 };

 savedAnnotation = await AnnotationService.createAnnotation(
 organizationId,
 author,
 dto
 );
 }

 if (savedAnnotation) {
 onSave?.(savedAnnotation);
 onClose();
 } else {
 setError('Erreur lors de la sauvegarde');
 }
 } catch (err) {
   ErrorLogger.handleErrorWithToast(err, 'AnnotationCreator');
 setError(err instanceof Error ? err.message : 'Erreur inconnue');
 } finally {
 setIsSaving(false);
 }
 }, [content, type, color, visibility, teamId, author, editingAnnotation, position, nodeId, organizationId, onSave, onClose]);

 // Handle keyboard shortcut (Escape to close)
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && isOpen) {
 onClose();
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen, onClose]);

 // Handle drag
 const handleDragStart = useCallback((e: React.MouseEvent) => {
 e.preventDefault();
 // setIsDragging(true);

 const startX = e.clientX - panelOffset.x;
 const startY = e.clientY - panelOffset.y;

 const handleMouseMove = (moveEvent: MouseEvent) => {
 setPanelOffset({
 x: moveEvent.clientX - startX,
 y: moveEvent.clientY - startY,
 });
 };

 const handleMouseUp = () => {
 // setIsDragging(false);
 window.removeEventListener('mousemove', handleMouseMove);
 window.removeEventListener('mouseup', handleMouseUp);
 };

 window.addEventListener('mousemove', handleMouseMove);
 window.addEventListener('mouseup', handleMouseUp);
 }, [panelOffset]);

 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0, scale: 0.9, y: 20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.9, y: 20 }}
 transition={{ type: 'spring', damping: 25, stiffness: 300 }}
 className="fixed z-modal pointer-events-auto"
 style={{
 left: `calc(50% + ${panelOffset.x}px)`,
 top: `calc(50% + ${panelOffset.y}px)`,
 transform: 'translate(-50%, -50%)',
 }}
 >
 <div className="w-[400px] glass-premium rounded-3xl shadow-apple-xl overflow-hidden border border-border/40">
 {/* Header */}
 <div
 role="presentation"
 className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-muted/80 to-card/80 cursor-move"
 onMouseDown={handleDragStart}
 >

 <div className="flex items-center gap-3">
 <GripVertical className="w-4 h-4 text-muted-foreground" />
 <h3 className="text-base font-semibold text-foreground">
 {editingAnnotation ? 'Modifier l\'annotation' : 'Nouvelle annotation'}
 </h3>
 </div>
 <button
 onClick={onClose}
 className="p-2 rounded-3xl hover:bg-muted/50 transition-colors"
 aria-label="Fermer"
 >
 <X className="w-4 h-4 text-muted-foreground" />
 </button>
 </div>

 {/* Content */}
 <div className="p-5 space-y-5 bg-card/60">
 {/* Position indicator */}
 {position && (
 <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
 <span className="px-2 py-1 bg-muted/50 rounded">
  X: {position.x.toFixed(2)}
 </span>
 <span className="px-2 py-1 bg-muted/50 rounded">
  Y: {position.y.toFixed(2)}
 </span>
 <span className="px-2 py-1 bg-muted/50 rounded">
  Z: {position.z.toFixed(2)}
 </span>
 </div>
 )}

 {/* Type selector */}
 <div className="space-y-2">
 <label htmlFor="anno-type" className="text-sm font-medium text-muted-foreground">Type</label>

 <div className="flex gap-2" id="anno-type">
 {TYPE_OPTIONS.map((option) => (
  <button
  key={option.value || 'unknown'}
  onClick={() => setType(option.value)}
  aria-pressed={type === option.value}
  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-3xl transition-all ${type === option.value
  ? 'bg-primary/15 border-2 border-primary text-primary/70'
  : 'bg-muted/50 border-2 border-transparent text-muted-foreground hover:bg-muted/80'
  }`}
  >
  {option.icon}
  <span className="text-xs font-medium">{option.label}</span>
  </button>
 ))}
 </div>

 </div>

 {/* Content textarea */}
 <div className="space-y-2">
 <label htmlFor="anno-content" className="text-sm font-medium text-muted-foreground">Contenu</label>
 <textarea
 id="anno-content"
 value={content}
 onChange={(e) => setContent(e.target.value)}
 placeholder="Écrivez votre annotation... (Utilisez @nom pour mentionner quelqu'un)"
 rows={4}
 className="w-full px-4 py-3 bg-muted/50 border border-border rounded-3xl text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent resize-none text-sm"
 />

 <p className="text-xs text-muted-foreground">
 Supporte Markdown. Utilisez @username pour mentionner des collègues.
 </p>
 </div>

 {/* Color picker */}
 <div className="space-y-2">
 <label htmlFor="anno-color" className="text-sm font-medium text-muted-foreground">Couleur</label>

 <div className="flex gap-2" id="anno-color">
 {COLOR_PRESETS.map((presetColor) => (
  <button
  key={presetColor || 'unknown'}
  onClick={() => setColor(presetColor)}
  aria-label={`Sélectionner la couleur ${presetColor}`}
  aria-pressed={color === presetColor}
  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${color === presetColor ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : ''
  }`}
  style={{ backgroundColor: presetColor }}
  />
 ))}
 </div>

 </div>

 {/* Visibility selector */}
 <div className="space-y-2">
 <label htmlFor="anno-visibility" className="text-sm font-medium text-muted-foreground">Visibilite</label>

 <div className="flex gap-2" id="anno-visibility">
 {VISIBILITY_OPTIONS.map((option) => (
  <button
  key={option.value || 'unknown'}
  onClick={() => setVisibility(option.value)}
  aria-pressed={visibility === option.value}
  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-3xl transition-all ${visibility === option.value
  ? 'bg-primary/15 border-2 border-primary text-primary/70'
  : 'bg-muted/50 border-2 border-transparent text-muted-foreground hover:bg-muted/80'
  }`}
  >
  {option.icon}
  <span className="text-xs font-medium">{option.label}</span>
  </button>
 ))}
 </div>

 </div>

 {/* Team selector (shown only when visibility is 'team') */}
 {visibility === 'team' && (
 <div className="space-y-2">
 <label htmlFor="anno-team" className="text-sm font-medium text-muted-foreground">Équipe</label>
 <input
  id="anno-team"
  type="text"
  value={teamId}
  onChange={(e) => setTeamId(e.target.value)}
  placeholder="ID de l'équipe"
  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-3xl text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent text-sm"
 />
 </div>
 )}


 {/* Error message */}
 {error && (
 <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-500/30 rounded-3xl text-red-400 text-sm">
 {error}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between px-5 py-4 bg-muted/50 border-t border-border/50">
 <button
 onClick={onClose}
 className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
 disabled={isSaving}
 >
 Annuler
 </button>

 <div className="flex gap-2">
 <button
 disabled
 className="p-2 rounded-3xl bg-muted/50 text-muted-foreground cursor-not-allowed"
 title="Ajouter une piece jointe (bientot)"
 >
 <Paperclip className="w-4 h-4" />
 </button>

 <button
 onClick={handleSave}
 disabled={isSaving || !content.trim()}
 className={`flex items-center gap-2 px-5 py-2 rounded-3xl text-sm font-semibold transition-all ${isSaving || !content.trim()
  ? 'bg-primary/15 text-primary/70 cursor-not-allowed'
  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
  }`}
 >
 {isSaving ? (
  <>
  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
  <span>Sauvegarde...</span>
  </>
 ) : (
  <>
  <Check className="w-4 h-4" />
  <span>{editingAnnotation ? 'Mettre a jour' : 'Creer'}</span>
  </>
 )}
 </button>
 </div>
 </div>
 </div>
 </motion.div>
 </AnimatePresence>
 );
};

export default AnnotationCreator;

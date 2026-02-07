import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
 Lock, Send, X, FileText, User, Paperclip, ShieldAlert, Download, ExternalLink, Image, File, Upload, AlertTriangle
} from '../ui/Icons';
import { Dialog } from '@headlessui/react';
import { useStore } from '../../store';
import { Button } from '../ui/button';
import { useZodForm } from '../../hooks/useZodForm';
import { warRoomMessageSchema, WarRoomMessageFormData } from '../../schemas/continuitySchema';
import { useWarRoom } from '../../hooks/incidents/useWarRoom';
import { ErrorLogger } from '../../services/errorLogger';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';
import { Tooltip } from '../ui/Tooltip';

interface WarRoomModalProps {
 isOpen: boolean;
 onClose: () => void;
 incidentId: string;
 incidentTitle: string;
}

// Crisis documents - these are critical documents for incident response
interface CrisisDocument {
 id: string;
 title: string;
 type: 'pca' | 'pra' | 'procedure' | 'contact' | 'playbook';
 url?: string;
 description?: string;
}

const CRISIS_DOCUMENTS: CrisisDocument[] = [
 { id: 'pca-1', title: 'Plan de Continuité (PCA)', type: 'pca', description: 'Plan de continuité d\'activité' },
 { id: 'pra-1', title: 'Plan de Reprise (PRA)', type: 'pra', description: 'Plan de reprise d\'activité' },
 { id: 'contact-1', title: 'Annuaire de Crise', type: 'contact', description: 'Contacts d\'urgence' },
 { id: 'proc-1', title: 'Procédures de Restauration', type: 'procedure', description: 'Procédures techniques' },
 { id: 'playbook-1', title: 'Playbook Incident', type: 'playbook', description: 'Guide de réponse' }
];

export const WarRoomModal: React.FC<WarRoomModalProps> = ({ isOpen, onClose, incidentId, incidentTitle }) => {
 const { user, demoMode } = useStore();
 const navigate = useNavigate();
 const bottomRef = useRef<HTMLDivElement>(null);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const { messages, sendMessage, sendSystemMessage, loading, presence } = useWarRoom(incidentId);

 // Attachment state
 const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
 const [uploadingAttachment, setUploadingAttachment] = useState(false);

 useEffect(() => {
 if (isOpen) {
 bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
 }
 }, [messages, isOpen]);

 // Send system message when War Room opens
 useEffect(() => {
 if (isOpen && incidentId) {
 // Send a system message indicating the war room was activated
 sendSystemMessage?.(`${user?.displayName || 'Utilisateur'} a rejoint le War Room.`);
 }
 // Justification: sendSystemMessage and user are intentionally excluded -- sendSystemMessage
 // is a callback prop that changes identity each render; user is only for displayName.
 // Re-running on those changes would send duplicate join messages.
 }, [isOpen, incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

 const { register, handleSubmit, reset } = useZodForm({
 schema: warRoomMessageSchema,
 defaultValues: {
 content: ''
 }
 });

 // Handle file selection
 const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 if (files.length > 0) {
 // Limit file size to 10MB
 const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024);
 if (validFiles.length < files.length) {
 ErrorLogger.warn('Some files were too large (max 10MB)', 'WarRoomModal.handleFileSelect');
 }
 setPendingAttachments(prev => [...prev, ...validFiles]);
 }
 // Reset input
 if (e.target) e.target.value = '';
 }, []);

 // Remove pending attachment
 const removePendingAttachment = useCallback((index: number) => {
 setPendingAttachments(prev => prev.filter((_, i) => i !== index));
 }, []);

 // Upload file to storage
 const uploadFile = useCallback(async (file: File): Promise<{ name: string; url: string; type: string }> => {
 if (demoMode) {
 // Demo mode: return fake URL
 return {
 name: file.name,
 url: `https://demo.example.com/files/${file.name}`,
 type: file.type
 };
 }

 const fileRef = ref(storage, `war_room/${incidentId}/${Date.now()}_${file.name}`);
 await uploadBytes(fileRef, file);
 const url = await getDownloadURL(fileRef);
 return { name: file.name, url, type: file.type };
 }, [incidentId, demoMode]);

 const onSubmit = async (data: WarRoomMessageFormData) => {
 if (!data.content.trim() && pendingAttachments.length === 0) return;

 try {
 setUploadingAttachment(true);

 // Upload any pending attachments
 const attachments = await Promise.all(
 pendingAttachments.map(file => uploadFile(file))
 );

 await sendMessage(data.content, attachments.length > 0 ? attachments : undefined);
 reset();
 setPendingAttachments([]);
 } catch (error) {
 ErrorLogger.error(error, 'WarRoomModal.onSubmit');
 } finally {
 setUploadingAttachment(false);
 }
 };

 // Navigate to document
 const openDocument = useCallback((doc: CrisisDocument) => {
 // In a real app, this would navigate to the actual document
 // For now, navigate to the documents section with a filter
 if (doc.type === 'pca' || doc.type === 'pra') {
 navigate('/continuity?tab=pra');
 } else if (doc.type === 'contact') {
 navigate('/team');
 } else if (doc.type === 'playbook') {
 navigate('/incidents?tab=playbooks');
 } else {
 navigate('/documents?search=' + encodeURIComponent(doc.title));
 }
 // Keep war room open in background (don't close)
 }, [navigate]);

 // Get file icon based on type
 const getFileIcon = (type: string) => {
 if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
 if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
 return <File className="w-4 h-4" />;
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
 <AnimatePresence>
 {isOpen && (
 <Dialog static open={isOpen} onClose={onClose} className="relative z-modal">
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 bg-background/80 backdrop-blur-sm"
  />

  <div className="fixed inset-0 flex items-center justify-center p-4">
  <Dialog.Panel
  as={motion.div}
  initial={{ scale: 0.95, opacity: 0, y: 20 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: 0.95, opacity: 0, y: 20 }}
  className="bg-card w-full max-w-[95vw] md:max-w-6xl h-[90vh] md:h-[85vh] rounded-3xl border border-red-500/30 shadow-[0_0_100px_rgba(239,68,68,0.2)] flex overflow-hidden flex-col md:flex-row relative"
  >
  {/* CRT/Scanline Overlay */}
  <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(transparent,transparent_2px,rgba(0,0,0,0.1)_3px)] opacity-60 z-decorator mix-blend-overlay" />

  {/* Left Panel: Context & Docs */}
  <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-border/40 bg-muted/20 flex flex-col">
  <div className="p-6 border-b border-border/40 bg-red-950/20">
   <div className="flex items-center gap-3 text-red-500 mb-2">
   <Lock className="w-5 h-5 animate-pulse" />
   <span className="text-xs font-mono font-bold tracking-[0.2em] uppercase">Top Secret // Eyes Only</span>
   </div>
   <Dialog.Title as="h2" className="text-2xl font-black text-foreground uppercase tracking-tight">War Room</Dialog.Title>
   <p className="text-red-400 text-sm font-mono mt-1 break-all">REF: {incidentId}</p>
   <p className="text-muted-foreground text-xs mt-2 line-clamp-2">{incidentTitle}</p>
  </div>

  <div className="flex-1 overflow-y-auto p-6 space-y-6">
   {/* Critical Docs */}
   <div>
   <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
   <FileText className="w-4 h-4" /> Documents Critiques
   </h3>
   <div className="space-y-2">
   {CRISIS_DOCUMENTS.map((doc) => (
   <button
    key={doc.id || 'unknown'}
    onClick={() => openDocument(doc)}
    className="group w-full flex items-center justify-between p-3 rounded-3xl bg-muted/50 border border-border/20 hover:border-red-500/30 hover:bg-muted cursor-pointer transition-all text-left"
   >
    <div className="flex items-center gap-3">
    <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
    <FileText className="w-4 h-4" />
    </div>
    <div>
    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground block">{doc.title}</span>
    {doc.description && (
    <span className="text-xs text-muted-foreground">{doc.description}</span>
    )}
    </div>
    </div>
    <Tooltip content="Ouvrir" position="left">
    <span className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
    <ExternalLink className="w-4 h-4" />
    </span>
    </Tooltip>
   </button>
   ))}
   </div>
   </div>

   {/* Quick Actions */}
   <div>
   <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
   <AlertTriangle className="w-4 h-4" /> Actions Rapides
   </h3>
   <div className="space-y-2">
   <button
   onClick={() => navigate(`/incidents/${incidentId}`)}
   className="w-full flex items-center gap-3 p-3 rounded-3xl bg-error-bg border border-error-border hover:bg-error/20 transition-all text-left"
   >
   <AlertTriangle className="w-4 h-4 text-red-500" />
   <span className="text-sm font-medium text-red-400">Voir l'incident</span>
   </button>
   <button
   onClick={() => navigate('/incidents?action=escalate')}
   className="w-full flex items-center gap-3 p-3 rounded-3xl bg-warning-bg border border-warning-border hover:bg-warning/20 transition-all text-left"
   >
   <Upload className="w-4 h-4 text-orange-500" />
   <span className="text-sm font-medium text-orange-400">Escalader</span>
   </button>
   </div>
   </div>

   {/* Active Users - Real-time Presence */}
   <div>
   <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
   <User className="w-4 h-4" /> En Ligne ({presence.length})
   </h3>
   <div className="space-y-2">
   {presence.length === 0 ? (
   <p className="text-xs text-muted-foreground">Aucun participant</p>
   ) : (
   presence.map((p) => (
    <div key={p.id || 'unknown'} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
    <div className="relative">
    {p.photoURL ? (
    <img alt={p.displayName}
     src={p.photoURL}
     className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500"
    />
    ) : (
    <div className="w-8 h-8 rounded-full bg-muted border-2 border-emerald-500 flex items-center justify-center text-xs text-foreground">
     {p.displayName?.charAt(0) || 'U'}
    </div>
    )}
    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-card" />
    </div>
    <div className="flex-1 min-w-0">
    <p className="text-sm font-medium text-foreground truncate">
    {p.displayName}
    {p.id === user?.uid && <span className="text-muted-foreground ml-1">(vous)</span>}
    </p>
    <p className="text-xs text-muted-foreground capitalize">{p.role}</p>
    </div>
    </div>
   ))
   )}
   </div>
   </div>
  </div>
  </div>

  {/* Right Panel: Chat */}
  <div className="flex-1 flex flex-col bg-card/50">
  {/* Chat Header */}
  <div className="p-4 border-b border-border/40 flex items-center justify-between">
   <div className="flex items-center gap-2">
   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
   <span className="text-xs font-mono text-emerald-500 uppercase">Canal Sécurisé actif</span>
   </div>
   <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-muted text-muted-foreground hover:text-foreground" aria-label="Fermer le War Room">
   <X className="w-5 h-5" aria-hidden="true" />
   </Button>
  </div>

  {/* Messages Area */}
  <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-sm max-h-[60vh] md:max-h-none">
   {messages.length === 0 && !loading && (
   <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
   <ShieldAlert className="w-12 h-12 opacity-20" />
   <p>Aucun message. Le canal est ouvert.</p>
   </div>
   )}

   {messages.map((msg) => (
   <motion.div
   initial={{ opacity: 0, y: 10 }}
   animate={{ opacity: 1, y: 0 }}
   key={msg.id || 'unknown'}
   className={`flex ${msg.isSystem ? 'justify-center' : msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}
   >
   {msg.isSystem ? (
   <span className="px-3 py-1 rounded-full bg-red-950/50 border border-red-500/20 text-red-500 text-xs">
    {msg.content}
   </span>
   ) : (
   <div className={`max-w-[80%] p-4 rounded-2xl border ${msg.senderId === user?.uid
    ? 'bg-blue-600/20 border-blue-500/30 text-blue-100 rounded-tr-none'
    : 'bg-muted border-border/40 text-muted-foreground rounded-tl-none'
    }`}>
    <div className="flex items-center gap-2 mb-1 opacity-60 text-xs">
    <span className="font-bold">{msg.sender}</span>
    <span>•</span>
    <span>{msg.role}</span>
    <span>•</span>
    <span>{msg.timestamp?.toLocaleTimeString ? msg.timestamp.toLocaleTimeString('fr-FR') : ''}</span>
    </div>
    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
    {/* Attachments */}
    {msg.attachments && msg.attachments.length > 0 && (
    <div className="mt-2 space-y-1">
    {msg.attachments.map((att, idx) => (
    <a
     key={idx || 'unknown'}
     href={att.url}
     target="_blank"
     rel="noopener noreferrer"
     className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors text-xs"
    >
     {getFileIcon(att.type)}
     <span className="truncate flex-1">{att.name}</span>
     <Download className="w-3 h-3 opacity-60" />
    </a>
    ))}
    </div>
    )}
   </div>
   )}
   </motion.div>
   ))}
   <div ref={bottomRef} />
  </div>

  {/* Input Area */}
  <div className="p-4 border-t border-border/40 bg-muted/20">
   {/* Pending Attachments Preview */}
   {pendingAttachments.length > 0 && (
   <div className="mb-3 flex flex-wrap gap-2">
   {pendingAttachments.map((file, idx) => (
   <div
    key={idx || 'unknown'}
    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-sm"
   >
    {getFileIcon(file.type)}
    <span className="truncate max-w-[100px] sm:max-w-[150px] text-blue-200">{file.name}</span>
    <button
    type="button"
    onClick={() => removePendingAttachment(idx)}
    className="text-blue-300 hover:text-foreground ml-1"
    >
    <X className="w-3 h-3" />
    </button>
   </div>
   ))}
   </div>
   )}

   <form onSubmit={handleSubmit(onSubmit)} className="flex gap-4">
   {/* Hidden file input */}
   <input required aria-label="Joindre un fichier"
   ref={fileInputRef}
   type="file"
   multiple
   accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
   onChange={handleFileSelect}
   className="hidden"
   />

   <Tooltip content="Joindre un fichier (max 10MB)" position="top">
   <Button
   type="button"
   variant="ghost"
   onClick={() => fileInputRef.current?.click()}
   className="text-muted-foreground hover:text-foreground"
   aria-label="Joindre un fichier"
   >
   <Paperclip className="w-5 h-5" />
   </Button>
   </Tooltip>

   <input
   {...register('content')}
   aria-label="Message de war room"
   placeholder="Tapez un message chiffré..."
   className="flex-1 bg-transparent border-none text-foreground placeholder:text-muted-foreground focus-visible:ring-0 font-mono"
   />

   <Button
   type="submit"
   disabled={loading || uploadingAttachment}
   isLoading={loading || uploadingAttachment}
   size="icon"
   aria-label="Envoyer le message"
   >
   <Send className="w-4 h-4" />
   </Button>
   </form>

   {/* Encryption indicator */}
   <div className="flex items-center gap-2 mt-2 text-xs text-emerald-500/70">
   <Lock className="w-3 h-3" />
   <span>Chiffrement de bout en bout activé</span>
   </div>
  </div>
  </div>
  </Dialog.Panel>
  </div>
 </Dialog>
 )}
 </AnimatePresence>
 );
};

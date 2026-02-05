/**
 * Unit tests for ThreatDiscussion component
 * Tests threat discussion panel in slide-over dialog
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThreatDiscussion } from '../ThreatDiscussion';

// Mock Headless UI with inline implementation
vi.mock('@headlessui/react', () => {
 const Dialog = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
 <div
 data-testid="dialog"
 onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
 onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
 role="button"
 tabIndex={0}
 aria-label="Close dialog"
 >
 {children}
 </div>
 );
 Dialog.Panel = ({ children, className }: { children: React.ReactNode; className?: string }) => (
 <div data-testid="dialog-panel" className={className}>{children}</div>
 );
 Dialog.Title = ({ children, className }: { children: React.ReactNode; className?: string }) => (
 <h2 data-testid="dialog-title" className={className}>{children}</h2>
 );

 return {
 Dialog,
 Transition: {
 Root: ({ show, children }: { show: boolean; children: React.ReactNode }) =>
 show ? <div data-testid="transition">{children}</div> : null,
 Child: ({ children }: { children: React.ReactNode }) => <>{children}</>
 }
 };
});

// Mock DiscussionPanel
vi.mock('../../collaboration/DiscussionPanel', () => ({
 DiscussionPanel: ({ collectionName, documentId }: { collectionName: string; documentId: string }) => (
 <div data-testid="discussion-panel" data-collection={collectionName} data-document={documentId}>
 Discussion Panel
 </div>
 )
}));

describe('ThreatDiscussion', () => {
 const defaultProps = {
 threatId: 'threat-1',
 threatTitle: 'APT-29 Campaign',
 isOpen: true,
 onClose: vi.fn()
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('rendering when open', () => {
 it('renders dialog when open', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 expect(screen.getByTestId('transition')).toBeInTheDocument();
 });

 it('renders dialog title', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 expect(screen.getByText('Discussion')).toBeInTheDocument();
 });

 it('renders threat title', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 expect(screen.getByText('APT-29 Campaign')).toBeInTheDocument();
 });

 it('renders close button', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 expect(screen.getByText('Fermer panel')).toBeInTheDocument();
 });

 it('renders discussion panel', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 expect(screen.getByTestId('discussion-panel')).toBeInTheDocument();
 });

 it('passes correct props to discussion panel', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 const panel = screen.getByTestId('discussion-panel');
 expect(panel).toHaveAttribute('data-collection', 'threats');
 expect(panel).toHaveAttribute('data-document', 'threat-1');
 });
 });

 describe('when closed', () => {
 it('does not render dialog when closed', () => {
 render(<ThreatDiscussion {...defaultProps} isOpen={false} />);

 expect(screen.queryByTestId('transition')).not.toBeInTheDocument();
 });
 });

 describe('interactions', () => {
 it('calls onClose when close button clicked', () => {
 render(<ThreatDiscussion {...defaultProps} />);

 const closeButton = screen.getByText('Fermer panel').closest('button');
 if (closeButton) {
 fireEvent.click(closeButton);
 expect(defaultProps.onClose).toHaveBeenCalled();
 }
 });
 });
});

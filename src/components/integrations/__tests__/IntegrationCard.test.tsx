/**
 * Unit tests for IntegrationCard component
 * Tests integration provider card display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntegrationCard } from '../IntegrationCard';

describe('IntegrationCard', () => {
 const mockOnConnect = vi.fn();
 const mockOnDisconnect = vi.fn();

 const disconnectedProvider = {
 id: 'jira',
 name: 'Jira',
 description: 'Synchronisez vos tickets de sécurité',
 status: 'disconnected' as const,
 icon: 'jira',
 category: 'productivity' as const
 };

 const connectedProvider = {
 id: 'slack',
 name: 'Slack',
 description: 'Recevez des alertes en temps réel',
 status: 'connected' as const,
 icon: 'slack',
 category: 'productivity' as const
 };

 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('disconnected state', () => {
 it('renders provider name', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(screen.getByText('Jira')).toBeInTheDocument();
 });

 it('renders provider description', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(screen.getByText('Synchronisez vos tickets de sécurité')).toBeInTheDocument();
 });

 it('renders connect button', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(screen.getByText('Connecter')).toBeInTheDocument();
 });

 it('does not show connected badge', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(screen.queryByText('Connecté')).not.toBeInTheDocument();
 });

 it('calls onConnect when connect clicked', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 fireEvent.click(screen.getByText('Connecter'));

 expect(mockOnConnect).toHaveBeenCalledWith(disconnectedProvider);
 });
 });

 describe('connected state', () => {
 it('shows connected badge', () => {
 render(
 <IntegrationCard
  provider={connectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(screen.getByText('Connecté')).toBeInTheDocument();
 });

 it('renders disconnect button', () => {
 render(
 <IntegrationCard
  provider={connectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(screen.getByText('Déconnecter')).toBeInTheDocument();
 });

 it('calls onDisconnect when disconnect clicked', () => {
 render(
 <IntegrationCard
  provider={connectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 fireEvent.click(screen.getByText('Déconnecter'));

 expect(mockOnDisconnect).toHaveBeenCalledWith(connectedProvider);
 });
 });

 describe('connecting state', () => {
 it('shows loading text when connecting', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={true}
 />
 );

 expect(screen.getByText('Traitement...')).toBeInTheDocument();
 });

 it('disables button when connecting', () => {
 render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={true}
 />
 );

 expect(screen.getByText('Traitement...').closest('button')).toBeDisabled();
 });
 });

 describe('styling', () => {
 it('has connected styling when connected', () => {
 const { container } = render(
 <IntegrationCard
  provider={connectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(container.querySelector('.bg-emerald-50\\/50')).toBeInTheDocument();
 });

 it('has disconnected styling when disconnected', () => {
 const { container } = render(
 <IntegrationCard
  provider={disconnectedProvider}
  onConnect={mockOnConnect}
  onDisconnect={mockOnDisconnect}
  isConnecting={false}
 />
 );

 expect(container.querySelector('.glass-premium')).toBeInTheDocument();
 });
 });
});

/**
 * Unit tests for RoleCard component
 * Tests role display card
 */

/* eslint-disable jsx-a11y/aria-role */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleCard } from '../RoleCard';

// Mock permissions utils
vi.mock('../../../utils/permissions', () => ({
 getRoleName: (role: string) => {
 const names: Record<string, string> = {
 admin: 'Administrateur',
 rssi: 'RSSI',
 auditor: 'Auditeur',
 user: 'Utilisateur'
 };
 return names[role] || role;
 },
 getRoleDescription: (role: string) => {
 const descriptions: Record<string, string> = {
 admin: 'Accès complet à toutes les fonctionnalités',
 rssi: 'Gestion de la sécurité et des risques',
 auditor: 'Consultation et audit des données',
 user: 'Accès limité aux fonctionnalités de base'
 };
 return descriptions[role] || 'Description non disponible';
 }
}));

describe('RoleCard', () => {
 describe('admin role', () => {
 it('renders role name', () => {
 render(<RoleCard role="admin" count={5} />);

 expect(screen.getByText('Administrateur')).toBeInTheDocument();
 });

 it('renders role count', () => {
 render(<RoleCard role="admin" count={5} />);

 expect(screen.getByText('5')).toBeInTheDocument();
 });

 it('renders role description', () => {
 render(<RoleCard role="admin" count={5} />);

 expect(screen.getByText('Accès complet à toutes les fonctionnalités')).toBeInTheDocument();
 });
 });

 describe('rssi role', () => {
 it('renders RSSI role name', () => {
 render(<RoleCard role="rssi" count={2} />);

 expect(screen.getByText('RSSI')).toBeInTheDocument();
 });

 it('renders RSSI description', () => {
 render(<RoleCard role="rssi" count={2} />);

 expect(screen.getByText('Gestion de la sécurité et des risques')).toBeInTheDocument();
 });
 });

 describe('auditor role', () => {
 it('renders auditor role name', () => {
 render(<RoleCard role="auditor" count={3} />);

 expect(screen.getByText('Auditeur')).toBeInTheDocument();
 });

 it('renders auditor description', () => {
 render(<RoleCard role="auditor" count={3} />);

 expect(screen.getByText('Consultation et audit des données')).toBeInTheDocument();
 });
 });

 describe('user role', () => {
 it('renders user role name', () => {
 render(<RoleCard role="user" count={10} />);

 expect(screen.getByText('Utilisateur')).toBeInTheDocument();
 });

 it('renders user description', () => {
 render(<RoleCard role="user" count={10} />);

 expect(screen.getByText('Accès limité aux fonctionnalités de base')).toBeInTheDocument();
 });
 });

 describe('zero count', () => {
 it('renders zero count', () => {
 render(<RoleCard role="admin" count={0} />);

 expect(screen.getByText('0')).toBeInTheDocument();
 });
 });

 describe('styling', () => {
 it('renders with glass premium class', () => {
 const { container } = render(<RoleCard role="admin" count={5} />);

 expect(container.querySelector('.glass-premium')).toBeInTheDocument();
 });

 it('renders count badge with brand styling', () => {
 const { container } = render(<RoleCard role="admin" count={5} />);

 expect(container.querySelector('.bg-primary')).toBeInTheDocument();
 });
 });
});

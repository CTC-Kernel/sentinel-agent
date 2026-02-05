/**
 * Toast Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toast, setGlobalNotificationContext } from '../toast';
import { NotificationContextType } from '../../contexts/NotificationContext';

describe('toast', () => {
 let mockContext: NotificationContextType;

 beforeEach(() => {
 mockContext = {
 addNotification: vi.fn().mockReturnValue('notification-123'),
 removeNotification: vi.fn(),
 notifications: [],
 unreadCount: 0,
 loading: false,
 isOpen: false,
 toggle: vi.fn(),
 markAsRead: vi.fn(),
 markAllAsRead: vi.fn(),
 setIsOpen: vi.fn(),
 clearNotifications: vi.fn()
 };
 setGlobalNotificationContext(mockContext);
 });

 afterEach(() => {
 setGlobalNotificationContext(null);
 });

 describe('success', () => {
 it('should show success notification with default title', () => {
 toast.success('Operation completed');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'success',
 title: 'Succès',
 message: 'Operation completed'
 });
 });

 it('should show success notification with custom title', () => {
 toast.success('Custom Title', 'Custom message');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'success',
 title: 'Custom Title',
 message: 'Custom message'
 });
 });

 it('should return empty string when no context', () => {
 setGlobalNotificationContext(null);
 const result = toast.success('Test');
 expect(result).toBe('');
 });
 });

 describe('error', () => {
 it('should show error notification with default title', () => {
 toast.error('Something went wrong');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'error',
 title: 'Erreur',
 message: 'Something went wrong'
 });
 });

 it('should show error notification with custom title', () => {
 toast.error('Network Error', 'Could not connect to server');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'error',
 title: 'Network Error',
 message: 'Could not connect to server'
 });
 });
 });

 describe('warning', () => {
 it('should show warning notification with default title', () => {
 toast.warning('Be careful');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'warning',
 title: 'Attention',
 message: 'Be careful'
 });
 });

 it('should show warning notification with custom title', () => {
 toast.warning('Warning', 'Disk space low');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'warning',
 title: 'Warning',
 message: 'Disk space low'
 });
 });
 });

 describe('info', () => {
 it('should show info notification with default title', () => {
 toast.info('FYI');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'info',
 title: 'Information',
 message: 'FYI'
 });
 });

 it('should show info notification with custom title', () => {
 toast.info('Update Available', 'New version is ready');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'info',
 title: 'Update Available',
 message: 'New version is ready'
 });
 });
 });

 describe('persistent', () => {
 it('should show persistent notification', () => {
 toast.persistent('info', 'Please wait', 'Processing...');

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'info',
 title: 'Please wait',
 message: 'Processing...',
 persistent: true
 });
 });

 it('should return empty string when no context', () => {
 setGlobalNotificationContext(null);
 const result = toast.persistent('info', 'Test');
 expect(result).toBe('');
 });
 });

 describe('dismiss', () => {
 it('should remove notification by id', () => {
 toast.dismiss('notification-123');

 expect(mockContext.removeNotification).toHaveBeenCalledWith('notification-123');
 });

 it('should do nothing when no context', () => {
 setGlobalNotificationContext(null);
 // Should not throw
 expect(() => toast.dismiss('notification-123')).not.toThrow();
 });
 });

 describe('promise', () => {
 it('should show loading notification and resolve to success', async () => {
 const promise = Promise.resolve({ data: 'result' });

 await toast.promise(promise, {
 loading: 'Loading...',
 success: 'Done!',
 error: 'Failed'
 });

 // Loading notification
 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'info',
 title: 'Chargement',
 message: 'Loading...',
 persistent: true
 });

 // Success notification
 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'success',
 title: 'Succès',
 message: 'Done!'
 });

 // Remove loading notification
 expect(mockContext.removeNotification).toHaveBeenCalled();
 });

 it('should show error notification on rejection', async () => {
 const promise = Promise.reject(new Error('Network error'));

 toast.promise(promise, {
 loading: 'Loading...',
 success: 'Done!',
 error: 'Failed'
 });

 // Wait for promise rejection and handler to complete
 await promise.catch(() => { });
 // Allow microtask queue to flush
 await new Promise(resolve => setTimeout(resolve, 0));

 // Error notification
 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'error',
 title: 'Erreur',
 message: 'Failed'
 });
 });

 it('should use function for success message', async () => {
 const promise = Promise.resolve({ name: 'Test' });

 await toast.promise(promise, {
 loading: 'Loading...',
 success: (data: { name: string }) => `Created ${data.name}`,
 error: 'Failed'
 });

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'success',
 title: 'Succès',
 message: 'Created Test'
 });
 });

 it('should use function for error message', async () => {
 const error = new Error('Custom error');
 const promise = Promise.reject(error);

 toast.promise(promise, {
 loading: 'Loading...',
 success: 'Done!',
 error: (err: unknown) => `Error: ${(err as Error).message}`
 });

 // Wait for promise rejection and handler to complete
 await promise.catch(() => { });
 // Allow microtask queue to flush
 await new Promise(resolve => setTimeout(resolve, 0));

 expect(mockContext.addNotification).toHaveBeenCalledWith({
 type: 'error',
 title: 'Erreur',
 message: 'Error: Custom error'
 });
 });

 it('should return promise as-is when no context', () => {
 setGlobalNotificationContext(null);
 const promise = Promise.resolve('test');

 const result = toast.promise(promise, {
 loading: 'Loading',
 success: 'Done',
 error: 'Failed'
 });

 expect(result).toBe(promise);
 });
 });

 describe('setGlobalNotificationContext', () => {
 it('should set the context', () => {
 const newContext = {
 addNotification: vi.fn().mockReturnValue('new-id'),
 removeNotification: vi.fn(),
 notifications: [],
 unreadCount: 0,
 loading: false,
 isOpen: false,
 toggle: vi.fn(),
 markAsRead: vi.fn(),
 markAllAsRead: vi.fn(),
 setIsOpen: vi.fn(),
 clearNotifications: vi.fn()
 };

 setGlobalNotificationContext(newContext);
 toast.success('Test');

 expect(newContext.addNotification).toHaveBeenCalled();
 });

 it('should clear the context', () => {
 setGlobalNotificationContext(null);
 const result = toast.success('Test');
 expect(result).toBe('');
 });
 });
});

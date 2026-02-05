/**
 * Avatar Utilities Tests
 * Story 13-4: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { getDefaultAvatarUrl, getUserAvatarUrl, getAvatarSrc } from '../avatarUtils';

describe('Avatar Utilities', () => {
 describe('getDefaultAvatarUrl', () => {
 const getExpectedUrl = (name: string) =>
 `https://ui-avatars.com/api/?name=${name}&background=f1f5f9&color=475569&bold=true&font-size=0.45&length=2`;

 it('should return user avatar when no role provided', () => {
 expect(getDefaultAvatarUrl()).toBe(getExpectedUrl('USER'));
 });

 it('should return user avatar when undefined', () => {
 expect(getDefaultAvatarUrl(undefined)).toBe(getExpectedUrl('USER'));
 });

 it('should return admin avatar for admin role', () => {
 expect(getDefaultAvatarUrl('admin')).toBe(getExpectedUrl('ADMIN'));
 });

 it('should return admin avatar case-insensitively', () => {
 expect(getDefaultAvatarUrl('Admin')).toBe(getExpectedUrl('ADMIN'));
 expect(getDefaultAvatarUrl('ADMIN')).toBe(getExpectedUrl('ADMIN'));
 });

 it('should return auditor avatar for auditor role', () => {
 expect(getDefaultAvatarUrl('auditor')).toBe(getExpectedUrl('AUDITOR'));
 });

 it('should return rssi avatar for rssi role', () => {
 expect(getDefaultAvatarUrl('rssi')).toBe(getExpectedUrl('RSSI'));
 });

 it('should return project manager avatar for project_manager role', () => {
 expect(getDefaultAvatarUrl('project_manager')).toBe(getExpectedUrl('PROJECT_MANAGER'));
 });

 it('should return direction avatar for direction role', () => {
 expect(getDefaultAvatarUrl('direction')).toBe(getExpectedUrl('DIRECTION'));
 });

 it('should return user avatar for user role', () => {
 expect(getDefaultAvatarUrl('user')).toBe(getExpectedUrl('USER'));
 });
 });

 describe('getUserAvatarUrl', () => {
 const getExpectedUrl = (name: string) =>
 `https://ui-avatars.com/api/?name=${name}&background=f1f5f9&color=475569&bold=true&font-size=0.45&length=2`;

 it('should return photoURL when provided', () => {
 const photoURL = 'https://example.com/photo.jpg';
 expect(getUserAvatarUrl(photoURL, 'admin')).toBe(photoURL);
 });

 it('should return default avatar when photoURL is null', () => {
 expect(getUserAvatarUrl(null, 'admin')).toBe(getExpectedUrl('ADMIN'));
 });

 it('should return default avatar when photoURL is undefined', () => {
 expect(getUserAvatarUrl(undefined, 'rssi')).toBe(getExpectedUrl('RSSI'));
 });

 it('should return default avatar when photoURL is empty string', () => {
 expect(getUserAvatarUrl('', 'direction')).toBe(getExpectedUrl('DIRECTION'));
 });

 it('should return user avatar when no photoURL and no role', () => {
 expect(getUserAvatarUrl(null)).toBe(getExpectedUrl('USER'));
 });
 });

 describe('getAvatarSrc', () => {
 const getExpectedUrl = (name: string) =>
 `https://ui-avatars.com/api/?name=${name}&background=f1f5f9&color=475569&bold=true&font-size=0.45&length=2`;

 it('should return photoURL when provided', () => {
 const photoURL = 'https://cdn.example.com/avatar.png';
 expect(getAvatarSrc(photoURL, 'user')).toBe(photoURL);
 });

 it('should return default avatar when photoURL is null', () => {
 expect(getAvatarSrc(null, 'auditor')).toBe(getExpectedUrl('AUDITOR'));
 });

 it('should return default avatar when photoURL is undefined', () => {
 expect(getAvatarSrc(undefined, 'project_manager')).toBe(getExpectedUrl('PROJECT_MANAGER'));
 });

 it('should return user avatar by default', () => {
 expect(getAvatarSrc(null)).toBe(getExpectedUrl('USER'));
 });
 });
});

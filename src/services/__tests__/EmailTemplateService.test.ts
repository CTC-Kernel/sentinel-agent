/**
 * Unit tests for EmailTemplateService
 * Tests email HTML template generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailTemplateService } from '../EmailTemplateService';

describe('EmailTemplateService', () => {
 const mockDate = new Date('2024-06-15');

 beforeEach(() => {
 vi.useFakeTimers();
 vi.setSystemTime(mockDate);
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 describe('generateHtml', () => {
 it('generates valid HTML document', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Test Title',
 content: '<p>Test content</p>'
 });

 expect(result).toContain('<!DOCTYPE html>');
 expect(result).toContain('<html lang="fr">');
 expect(result).toContain('</html>');
 });

 it('includes the title in the HTML', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'My Email Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('<title>My Email Title</title>');
 expect(result).toContain('<h1 class="title">My Email Title</h1>');
 });

 it('includes the content', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>This is the email body content</p>'
 });

 expect(result).toContain('<p>This is the email body content</p>');
 });

 it('includes action button when actionLabel and actionUrl provided', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>',
 actionLabel: 'Click Here',
 actionUrl: 'https://example.com/action'
 });

 expect(result).toContain('href="https://example.com/action"');
 expect(result).toContain('Click Here');
 expect(result).toContain('class="btn"');
 });

 it('does not include action button when actionLabel missing', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>',
 actionUrl: 'https://example.com/action'
 });

 expect(result).not.toContain('class="btn"');
 });

 it('does not include action button when actionUrl missing', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>',
 actionLabel: 'Click Here'
 });

 expect(result).not.toContain('class="btn"');
 });

 it('includes current year in footer', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('2024');
 expect(result).toContain('Cyber Threat Consulting');
 });

 it('uses custom footer text when provided', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>',
 footerText: 'Custom footer message'
 });

 expect(result).toContain('Custom footer message');
 });

 it('uses default footer text when not provided', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('ISO 27001');
 });

 it('includes Sentinel GRC branding', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('Sentinel');
 expect(result).toContain('GRC');
 });

 it('includes responsive CSS', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('@media only screen and (max-width: 600px)');
 });

 it('includes Outlook-specific meta tags', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('[if mso]');
 expect(result).toContain('PixelsPerInch');
 });

 it('includes alert box styles', () => {
 const result = EmailTemplateService.generateHtml({
 title: 'Title',
 content: '<p>Content</p>'
 });

 expect(result).toContain('.alert-danger');
 expect(result).toContain('.alert-warning');
 expect(result).toContain('.alert-info');
 expect(result).toContain('.alert-success');
 });
 });
});

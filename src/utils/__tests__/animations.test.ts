/**
 * Animation Variants Tests
 * Epic 14-1: Test Coverage Improvement
 */

import { describe, it, expect } from 'vitest';
import { slideUpVariants, fadeInUp, staggerContainer } from '../animations';

describe('Animation Variants', () => {
 describe('slideUpVariants', () => {
 it('should have hidden state with opacity 0 and y offset', () => {
 expect(slideUpVariants.hidden).toEqual({ opacity: 0, y: 20 });
 });

 it('should have visible state with full opacity and no offset', () => {
 expect(slideUpVariants.visible.opacity).toBe(1);
 expect(slideUpVariants.visible.y).toBe(0);
 });

 it('should have transition duration of 0.5s', () => {
 expect(slideUpVariants.visible.transition.duration).toBe(0.5);
 });
 });

 describe('fadeInUp', () => {
 it('should have hidden state with opacity 0 and y offset', () => {
 expect(fadeInUp.hidden).toEqual({ opacity: 0, y: 20 });
 });

 it('should have visible state with full opacity and no offset', () => {
 expect(fadeInUp.visible).toEqual({ opacity: 1, y: 0 });
 });
 });

 describe('staggerContainer', () => {
 it('should have hidden state with opacity 0', () => {
 expect(staggerContainer.hidden).toEqual({ opacity: 0 });
 });

 it('should have visible state with opacity 1', () => {
 expect(staggerContainer.visible.opacity).toBe(1);
 });

 it('should have staggerChildren transition of 0.1s', () => {
 expect(staggerContainer.visible.transition.staggerChildren).toBe(0.1);
 });
 });
});

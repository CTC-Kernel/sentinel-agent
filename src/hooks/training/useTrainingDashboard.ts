/**
 * useTrainingDashboard Hook
 *
 * Provides data aggregation and statistics for the Training Dashboard.
 * Calculates completion rates by department, trends, and overdue assignments.
 *
 * @module useTrainingDashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../useAuth';
import { TrainingService } from '../../services/TrainingService';
import { ErrorLogger } from '../../services/errorLogger';
import type {
 TrainingAssignment,
 TrainingCourse,
 TrainingStats,
 DepartmentTrainingStats,
 TrainingTrendPoint,
} from '../../types/training';
import type { UserProfile } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface TrainingDashboardData {
 stats: TrainingStats;
 byDepartment: DepartmentTrainingStats[];
 trend: TrainingTrendPoint[];
 overdueAssignments: (TrainingAssignment & { userName?: string; courseName?: string })[];
 courses: TrainingCourse[];
}

export interface UseTrainingDashboardReturn {
 data: TrainingDashboardData | null;
 isLoading: boolean;
 error: string | null;
 refresh: () => Promise<void>;
 exportCSV: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate trend data for the last N days
 */
const calculateTrend = (
 assignments: TrainingAssignment[],
 days: number = 30
): TrainingTrendPoint[] => {
 const now = new Date();
 const trend: TrainingTrendPoint[] = [];

 for (let i = days - 1; i >= 0; i--) {
 const date = new Date(now);
 date.setDate(date.getDate() - i);
 const dateStr = date.toISOString().split('T')[0];

 // Count assignments completed on this date
 const completed = assignments.filter((a) => {
 if (a.status !== 'completed' || !a.completedAt) return false;
 const completedDate = a.completedAt.toDate().toISOString().split('T')[0];
 return completedDate === dateStr;
 }).length;

 // Count assignments assigned on this date
 const assigned = assignments.filter((a) => {
 const assignedDate = a.assignedAt.toDate().toISOString().split('T')[0];
 return assignedDate === dateStr;
 }).length;

 trend.push({
 date: dateStr,
 completed,
 assigned,
 });
 }

 return trend;
};

/**
 * Calculate stats by department
 */
const calculateDepartmentStats = (
 assignments: TrainingAssignment[],
 users: Map<string, UserProfile>
): DepartmentTrainingStats[] => {
 const deptMap = new Map<
 string,
 { total: number; completed: number }
 >();

 assignments.forEach((assignment) => {
 const user = users.get(assignment.userId);
 const dept = user?.department || 'Unknown';

 if (!deptMap.has(dept)) {
 deptMap.set(dept, { total: 0, completed: 0 });
 }

 const deptStats = deptMap.get(dept)!;
 deptStats.total++;
 if (assignment.status === 'completed') {
 deptStats.completed++;
 }
 });

 return Array.from(deptMap.entries())
 .map(([department, { total, completed }]) => ({
 department,
 total,
 completed,
 completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
 }))
 .sort((a, b) => b.total - a.total);
};

/**
 * Generate CSV content from dashboard data
 */
const generateCSV = (
 stats: TrainingStats,
 byDepartment: DepartmentTrainingStats[],
 overdueAssignments: (TrainingAssignment & { userName?: string; courseName?: string })[]
): string => {
 const lines: string[] = [];

 // Global Stats
 lines.push('=== Training Statistics ===');
 lines.push(`Total Assignments,${stats.total}`);
 lines.push(`Completed,${stats.completed}`);
 lines.push(`In Progress,${stats.inProgress}`);
 lines.push(`Overdue,${stats.overdue}`);
 lines.push(`Completion Rate,${stats.completionRate}%`);
 lines.push('');

 // Department Stats
 lines.push('=== By Department ===');
 lines.push('Department,Total,Completed,Completion Rate');
 byDepartment.forEach((dept) => {
 lines.push(`${dept.department},${dept.total},${dept.completed},${dept.completionRate}%`);
 });
 lines.push('');

 // Overdue Assignments
 lines.push('=== Overdue Assignments ===');
 lines.push('User,Course,Due Date,Days Overdue');
 overdueAssignments.forEach((a) => {
 const dueDate = a.dueDate.toDate();
 const daysOverdue = Math.ceil((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
 lines.push(`${a.userName || a.userId},${a.courseName || a.courseId},${dueDate.toLocaleDateString('fr-FR')},${daysOverdue}`);
 });

 return lines.join('\n');
};

// ============================================================================
// Hook
// ============================================================================

export const useTrainingDashboard = (): UseTrainingDashboardReturn => {
 const { user } = useAuth();
 const [data, setData] = useState<TrainingDashboardData | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const fetchData = useCallback(async () => {
 if (!user?.organizationId) return;

 setIsLoading(true);
 setError(null);

 try {
 // Fetch all data in parallel
 const [assignments, courses, usersSnapshot] = await Promise.all([
 TrainingService.getAllAssignments(user.organizationId),
 TrainingService.getCourses(user.organizationId),
 getDocs(
 query(
 collection(db, 'users'),
 where('organizationId', '==', user.organizationId)
 )
 ),
 ]);

 // Build user map for enrichment
 const usersMap = new Map<string, UserProfile>();
 usersSnapshot.docs.forEach((doc) => {
 const userData = doc.data() as UserProfile;
 usersMap.set(doc.id, userData);
 });

 // Build course map for enrichment
 const coursesMap = new Map<string, TrainingCourse>();
 courses.forEach((course) => {
 coursesMap.set(course.id, course);
 });

 // Calculate stats
 const total = assignments.length;
 const completed = assignments.filter((a) => a.status === 'completed').length;
 const inProgress = assignments.filter((a) => a.status === 'in_progress').length;

 // Calculate overdue (status is 'overdue' OR dueDate passed and not completed)
 const now = new Date();
 const overdue = assignments.filter((a) => {
 if (a.status === 'completed') return false;
 if (a.status === 'overdue') return true;
 return a.dueDate.toDate() < now;
 }).length;

 const stats: TrainingStats = {
 total,
 completed,
 inProgress,
 overdue,
 completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
 };

 // Calculate department stats
 const byDepartment = calculateDepartmentStats(assignments, usersMap);

 // Calculate trend
 const trend = calculateTrend(assignments, 30);

 // Get overdue assignments with enrichment
 const overdueAssignments = assignments
 .filter((a) => {
 if (a.status === 'completed') return false;
 if (a.status === 'overdue') return true;
 return a.dueDate.toDate() < now;
 })
 .map((a) => ({
 ...a,
 userName: usersMap.get(a.userId)?.displayName || usersMap.get(a.userId)?.email,
 courseName: coursesMap.get(a.courseId)?.title,
 }))
 .sort((a, b) => a.dueDate.toDate().getTime() - b.dueDate.toDate().getTime());

 setData({
 stats,
 byDepartment,
 trend,
 overdueAssignments,
 courses,
 });
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
 setError(message);
 ErrorLogger.error(err, 'useTrainingDashboard.fetchData', {
 organizationId: user?.organizationId,
 });
 } finally {
 setIsLoading(false);
 }
 }, [user?.organizationId]);

 // Initial fetch
 useEffect(() => {
 fetchData();
 }, [fetchData]);

 // Export CSV function
 const exportCSV = useCallback(() => {
 if (!data) return;

 const csv = generateCSV(data.stats, data.byDepartment, data.overdueAssignments);
 const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = `training-report-${new Date().toISOString().split('T')[0]}.csv`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 URL.revokeObjectURL(url);
 }, [data]);

 return {
 data,
 isLoading,
 error,
 refresh: fetchData,
 exportCSV,
 };
};

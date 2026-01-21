import { doc, getDoc, collection, query, where, orderBy, limit as limitQuery, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types/users';
import { Threat } from '../types/risks';

export interface HunterStats {
    userId: string;
    totalContributions: number;
    verifiedThreats: number;
    averageResponseTime: number;
    threatsThisMonth: number;
    accuracyRate: number;
    reputationScore: number;
    collaborations: number;
    recentActivity: Array<{
        type: 'threat' | 'verification' | 'collaboration';
        title: string;
        date: string;
        impact: string;
    }>;
}

export interface HunterProfile {
    user: UserProfile;
    stats: HunterStats;
    expertise: string[];
    achievements: Array<{
        icon: React.ReactNode;
        title: string;
        description: string;
        date: string;
    }>;
}

export class HunterProfileService {
    /**
     * Get user profile by ID
     */
    static async getUserProfile(userId: string): Promise<UserProfile | null> {
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                return userDoc.data() as UserProfile;
            }
            return null;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }

    /**
     * Get user profile by email
     */
    static async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
        try {
            const usersQuery = query(
                collection(db, 'users'),
                where('email', '==', email),
                limitQuery(1)
            );
            const querySnapshot = await getDocs(usersQuery);
            
            if (!querySnapshot.empty) {
                return querySnapshot.docs[0].data() as UserProfile;
            }
            return null;
        } catch (error) {
            console.error('Error fetching user profile by email:', error);
            return null;
        }
    }

    /**
     * Calculate hunter statistics based on their contributions
     */
    static async calculateHunterStats(userId: string): Promise<HunterStats> {
        const now = new Date();
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        try {
            // Get user's threats
            const threatsQuery = query(
                collection(db, 'threats'),
                where('authorId', '==', userId),
                orderBy('timestamp', 'desc'),
                limitQuery(100)
            );
            const threatsSnapshot = await getDocs(threatsQuery);
            const threats = threatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Threat));

            // Calculate basic stats
            const totalContributions = threats.length;
            const verifiedThreats = threats.filter(t => t.verified === true).length;
            const threatsThisMonth = threats.filter(t => {
                if (!t.timestamp) return false;
                const threatDate = typeof t.timestamp === 'number' ? new Date(t.timestamp) : t.timestamp;
                return threatDate >= oneMonthAgo;
            }).length;

            // Calculate average response time (mock for now - would need timestamp fields)
            const averageResponseTime = 15; // minutes

            // Calculate accuracy rate
            const accuracyRate = totalContributions > 0 ? Math.round((verifiedThreats / totalContributions) * 100) : 0;

            // Calculate reputation score (based on contributions, verification rate, and recency)
            const reputationScore = Math.min(5.0, (
                (totalContributions * 0.01) +
                (accuracyRate * 0.02) +
                (threatsThisMonth * 0.05)
            ));

            // Calculate collaborations (mock for now - would need collaboration tracking)
            const collaborations = Math.floor(totalContributions * 0.3);

            // Generate recent activity
            const recentActivity = threats.slice(0, 5).map(threat => ({
                type: 'threat' as const,
                title: threat.title || 'Unknown threat',
                date: threat.timestamp ? (typeof threat.timestamp === 'number' ? new Date(threat.timestamp).toISOString() : threat.timestamp) : new Date().toISOString(),
                impact: `${threat.severity} - ${threat.type || 'Unknown type'}`
            }));

            return {
                userId,
                totalContributions,
                verifiedThreats,
                averageResponseTime,
                threatsThisMonth,
                accuracyRate,
                reputationScore: Math.round(reputationScore * 10) / 10,
                collaborations,
                recentActivity
            };
        } catch (error) {
            console.error('Error calculating hunter stats:', error);
            return {
                userId,
                totalContributions: 0,
                verifiedThreats: 0,
                averageResponseTime: 0,
                threatsThisMonth: 0,
                accuracyRate: 0,
                reputationScore: 0,
                collaborations: 0,
                recentActivity: []
            };
        }
    }

    /**
     * Get complete hunter profile with stats
     */
    static async getHunterProfile(userId: string): Promise<HunterProfile | null> {
        try {
            const user = await this.getUserProfile(userId);
            if (!user) {
                return null;
            }

            const stats = await this.calculateHunterStats(userId);

            // Determine expertise based on user's threats
            const expertise = await this.getUserExpertise(userId);

            // Generate achievements based on stats
            const achievements = this.generateAchievements(user, stats);

            return {
                user,
                stats,
                expertise,
                achievements
            };
        } catch (error) {
            console.error('Error getting hunter profile:', error);
            return null;
        }
    }

    /**
     * Get hunter profile by author name (from threat data)
     */
    static async getHunterProfileByName(authorName: string): Promise<HunterProfile | null> {
        try {
            // First try to find user by display name
            const usersQuery = query(
                collection(db, 'users'),
                where('displayName', '==', authorName),
                limitQuery(1)
            );
            const querySnapshot = await getDocs(usersQuery);

            if (!querySnapshot.empty) {
                const userId = querySnapshot.docs[0].id;
                return await this.getHunterProfile(userId);
            }

            // If not found by display name, try email (for system accounts)
            const emailQuery = query(
                collection(db, 'users'),
                where('email', '==', `${authorName.toLowerCase().replace(/\s+/g, '.')}@sentinel-grc.com`),
                limitQuery(1)
            );
            const emailSnapshot = await getDocs(emailQuery);

            if (!emailSnapshot.empty) {
                const userId = emailSnapshot.docs[0].id;
                return await this.getHunterProfile(userId);
            }

            return null;
        } catch (error) {
            console.error('Error getting hunter profile by name:', error);
            return null;
        }
    }

    /**
     * Get user expertise based on their threat contributions
     */
    private static async getUserExpertise(userId: string): Promise<string[]> {
        try {
            const threatsQuery = query(
                collection(db, 'threats'),
                where('authorId', '==', userId),
                limitQuery(50)
            );
            const threatsSnapshot = await getDocs(threatsQuery);
            const threats = threatsSnapshot.docs.map(doc => doc.data());

            // Extract unique threat types
            const threatTypes = [...new Set(threats.map(t => t.type).filter(Boolean))] as string[];

            // Map threat types to expertise areas
            const expertiseMap: Record<string, string> = {
                'Ransomware': 'Ransomware Analysis',
                'Malware': 'Malware Analysis',
                'Phishing': 'Social Engineering',
                'APT': 'Threat Intelligence',
                'Vulnerability': 'Vulnerability Research',
                'DDoS': 'Network Security',
                'Data Leak': 'Incident Response',
                'Botnet': 'Malware Analysis'
            };

            return threatTypes.map(type => expertiseMap[type] || type).slice(0, 5);
        } catch (error) {
            console.error('Error getting user expertise:', error);
            return ['Threat Analysis'];
        }
    }

    /**
     * Generate achievements based on user stats
     */
    private static generateAchievements(user: UserProfile, stats: HunterStats): Array<{
        icon: React.ReactNode;
        title: string;
        description: string;
        date: string;
    }> {
        const achievements = [];

        // Contribution milestones
        if (stats.totalContributions >= 100) {
            achievements.push({
                icon: '🏆',
                title: 'Century Club',
                description: '100+ contributions to the community',
                date: user.createdAt || new Date().toISOString()
            });
        } else if (stats.totalContributions >= 50) {
            achievements.push({
                icon: '🥇',
                title: 'Dedicated Hunter',
                description: '50+ contributions to the community',
                date: user.createdAt || new Date().toISOString()
            });
        }

        // Accuracy achievements
        if (stats.accuracyRate >= 95) {
            achievements.push({
                icon: '🎯',
                title: 'Precision Expert',
                description: '95%+ accuracy rate',
                date: new Date().toISOString()
            });
        }

        // Reputation achievements
        if (stats.reputationScore >= 4.5) {
            achievements.push({
                icon: '⭐',
                title: 'Trusted Contributor',
                description: '4.5+ reputation score',
                date: new Date().toISOString()
            });
        }

        // Recent activity
        if (stats.threatsThisMonth >= 20) {
            achievements.push({
                icon: '🔥',
                title: 'On Fire',
                description: '20+ contributions this month',
                date: new Date().toISOString()
            });
        }

        return achievements;
    }

    /**
     * Get top hunters across all organizations
     */
    static async getTopHunters(limit: number = 10): Promise<Array<{
        user: UserProfile;
        stats: HunterStats;
    }>> {
        try {
            // Get all users with their stats
            const limitValue = Math.min(100, limit);
            const usersQuery = query(
                collection(db, 'users'),
                orderBy('createdAt', 'desc'),
                limitQuery(limitValue)
            );
            const usersSnapshot = await getDocs(usersQuery);
            const users = usersSnapshot.docs.map(doc => ({ 
                uid: doc.id, 
                ...doc.data() 
            })) as UserProfile[];

            // Calculate stats for each user
            const hunterProfiles = await Promise.all(
                users.map(async (user) => {
                    const stats = await this.calculateHunterStats(user.uid);
                    return { user, stats };
                })
            );

            // Sort by total contributions and return top hunters
            return hunterProfiles
                .filter(hunter => hunter.stats.totalContributions > 0)
                .sort((a, b) => b.stats.totalContributions - a.stats.totalContributions)
                .slice(0, limit);
        } catch (error) {
            console.error('Error getting top hunters:', error);
            return [];
        }
    }
}

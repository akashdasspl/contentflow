import { 
  userService, 
  generatedContentService, 
  engagementFeedbackService, 
  contentIdeaService,
  learningProfileService 
} from './database';
import { feedbackProcessingService } from './feedback-processing';
import { Platform, ContentType, EngagementMetrics } from '../types';

/**
 * Analytics Dashboard Service
 * Provides comprehensive analytics and reporting for ContentFlow AI
 */
export class AnalyticsDashboardService {

  /**
   * Get comprehensive dashboard data for a user
   */
  async getDashboardData(userId: string, dateRange?: DateRangeFilter): Promise<DashboardData> {
    const [
      contentStats,
      engagementStats,
      platformStats,
      performanceMetrics,
      recentActivity,
      insights
    ] = await Promise.all([
      this.getContentGenerationStats(userId, dateRange),
      this.getEngagementStats(userId, dateRange),
      this.getPlatformStats(userId, dateRange),
      this.getPerformanceMetrics(userId, dateRange),
      this.getRecentActivity(userId, 10),
      this.generateInsights(userId, dateRange)
    ]);

    return {
      userId,
      dateRange: dateRange || this.getDefaultDateRange(),
      contentStats,
      engagementStats,
      platformStats,
      performanceMetrics,
      recentActivity,
      insights,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get content generation statistics
   */
  async getContentGenerationStats(userId: string, dateRange?: DateRangeFilter): Promise<ContentGenerationStats> {
    const allContent = await generatedContentService.getUserGeneratedContent(userId, 1000);
    const allIdeas = await contentIdeaService.getUserContentIdeas(userId, 1000);

    // Filter by date range if provided
    const filteredContent = dateRange ? 
      allContent.filter(c => this.isWithinDateRange(c.createdAt, dateRange)) : 
      allContent;
    
    const filteredIdeas = dateRange ? 
      allIdeas.filter(i => this.isWithinDateRange(i.createdAt, dateRange)) : 
      allIdeas;

    // Calculate statistics
    const totalContent = filteredContent.length;
    const totalIdeas = filteredIdeas.length;
    const totalWords = filteredContent.reduce((sum, c) => sum + (c.metadata?.wordCount || 0), 0);
    const averageWordsPerContent = totalContent > 0 ? Math.round(totalWords / totalContent) : 0;

    // Platform breakdown
    const platformBreakdown: Record<Platform, number> = {} as Record<Platform, number>;
    filteredContent.forEach(content => {
      platformBreakdown[content.platform] = (platformBreakdown[content.platform] || 0) + 1;
    });

    // Content type breakdown
    const contentTypeBreakdown: Record<ContentType, number> = {} as Record<ContentType, number>;
    filteredContent.forEach(content => {
      contentTypeBreakdown[content.contentType] = (contentTypeBreakdown[content.contentType] || 0) + 1;
    });

    // Quality metrics
    const qualityScores = filteredContent
      .map(c => c.metadata?.qualityScore)
      .filter(score => score !== undefined) as number[];
    
    const averageQualityScore = qualityScores.length > 0 ? 
      qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : 0;

    // Time-based analysis
    const contentByDate = this.groupContentByDate(filteredContent);
    const trend = this.calculateTrend(contentByDate);

    return {
      totalContent,
      totalIdeas,
      totalWords,
      averageWordsPerContent,
      averageQualityScore: Math.round(averageQualityScore * 10) / 10,
      platformBreakdown,
      contentTypeBreakdown,
      contentByDate,
      trend,
      topPerformingContent: await this.getTopPerformingContent(filteredContent, 5)
    };
  }

  /**
   * Get engagement statistics
   */
  async getEngagementStats(userId: string, dateRange?: DateRangeFilter): Promise<EngagementStats> {
    const allFeedback = await engagementFeedbackService.getUserFeedback(userId, 1000);
    
    // Filter by date range if provided
    const filteredFeedback = dateRange ? 
      allFeedback.filter(f => this.isWithinDateRange(f.timestamp, dateRange)) : 
      allFeedback;

    if (filteredFeedback.length === 0) {
      return this.getEmptyEngagementStats();
    }

    // Calculate totals
    let totalLikes = 0;
    let totalShares = 0;
    let totalComments = 0;
    let totalImpressions = 0;
    let totalReach = 0;
    let totalEngagementRate = 0;
    let totalClickThroughRate = 0;

    filteredFeedback.forEach(feedback => {
      const metrics = feedback.metrics;
      totalLikes += metrics.likes || 0;
      totalShares += metrics.shares || 0;
      totalComments += metrics.comments || 0;
      totalImpressions += metrics.impressions || 0;
      totalReach += metrics.reach || 0;
      totalEngagementRate += metrics.engagementRate || 0;
      totalClickThroughRate += metrics.clickThroughRate || 0;
    });

    const count = filteredFeedback.length;
    const totalEngagement = totalLikes + totalShares + totalComments;
    const averageEngagementRate = totalEngagementRate / count;
    const averageClickThroughRate = totalClickThroughRate / count;

    // Engagement by date
    const engagementByDate = this.groupEngagementByDate(filteredFeedback);
    const engagementTrend = this.calculateEngagementTrend(engagementByDate);

    // Best performing content
    const bestPerformingContent = await this.getBestPerformingContent(filteredFeedback, 5);

    return {
      totalEngagement,
      totalLikes,
      totalShares,
      totalComments,
      totalImpressions,
      totalReach,
      averageEngagementRate: Math.round(averageEngagementRate * 1000) / 1000,
      averageClickThroughRate: Math.round(averageClickThroughRate * 1000) / 1000,
      engagementByDate,
      engagementTrend,
      bestPerformingContent
    };
  }

  /**
   * Get platform-specific statistics
   */
  async getPlatformStats(userId: string, dateRange?: DateRangeFilter): Promise<PlatformStats> {
    const allFeedback = await engagementFeedbackService.getUserFeedback(userId, 1000);
    const allContent = await generatedContentService.getUserGeneratedContent(userId, 1000);
    
    // Filter by date range if provided
    const filteredFeedback = dateRange ? 
      allFeedback.filter(f => this.isWithinDateRange(f.timestamp, dateRange)) : 
      allFeedback;
    
    const filteredContent = dateRange ? 
      allContent.filter(c => this.isWithinDateRange(c.createdAt, dateRange)) : 
      allContent;

    const platformData: Record<Platform, PlatformMetrics> = {} as Record<Platform, PlatformMetrics>;

    // Initialize platform data
    const platforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
    platforms.forEach(platform => {
      platformData[platform] = {
        contentCount: 0,
        totalEngagement: 0,
        averageEngagementRate: 0,
        averageClickThroughRate: 0,
        totalImpressions: 0,
        totalReach: 0,
        bestPerformingContent: null
      };
    });

    // Calculate content counts
    filteredContent.forEach(content => {
      if (platformData[content.platform]) {
        platformData[content.platform].contentCount++;
      }
    });

    // Calculate engagement metrics
    const platformEngagementData: Record<Platform, { 
      totalEngagement: number; 
      totalEngagementRate: number; 
      totalClickThroughRate: number;
      totalImpressions: number;
      totalReach: number;
      count: number;
      bestContent: any;
    }> = {} as any;

    filteredFeedback.forEach(feedback => {
      const platform = feedback.platform;
      const metrics = feedback.metrics;
      
      if (!platformEngagementData[platform]) {
        platformEngagementData[platform] = {
          totalEngagement: 0,
          totalEngagementRate: 0,
          totalClickThroughRate: 0,
          totalImpressions: 0,
          totalReach: 0,
          count: 0,
          bestContent: null
        };
      }

      const engagement = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
      platformEngagementData[platform].totalEngagement += engagement;
      platformEngagementData[platform].totalEngagementRate += metrics.engagementRate || 0;
      platformEngagementData[platform].totalClickThroughRate += metrics.clickThroughRate || 0;
      platformEngagementData[platform].totalImpressions += metrics.impressions || 0;
      platformEngagementData[platform].totalReach += metrics.reach || 0;
      platformEngagementData[platform].count++;

      // Track best performing content
      if (!platformEngagementData[platform].bestContent || 
          engagement > platformEngagementData[platform].bestContent.engagement) {
        platformEngagementData[platform].bestContent = {
          contentId: feedback.contentId,
          engagement,
          engagementRate: metrics.engagementRate || 0,
          timestamp: feedback.timestamp
        };
      }
    });

    // Calculate averages and populate platform data
    Object.entries(platformEngagementData).forEach(([platform, data]) => {
      const platformKey = platform as Platform;
      if (platformData[platformKey] && data.count > 0) {
        platformData[platformKey].totalEngagement = data.totalEngagement;
        platformData[platformKey].averageEngagementRate = data.totalEngagementRate / data.count;
        platformData[platformKey].averageClickThroughRate = data.totalClickThroughRate / data.count;
        platformData[platformKey].totalImpressions = data.totalImpressions;
        platformData[platformKey].totalReach = data.totalReach;
        platformData[platformKey].bestPerformingContent = data.bestContent;
      }
    });

    // Find best and worst performing platforms
    const platformPerformance = Object.entries(platformData)
      .filter(([_, data]) => data.contentCount > 0)
      .map(([platform, data]) => ({
        platform: platform as Platform,
        score: data.averageEngagementRate + data.averageClickThroughRate,
        ...data
      }))
      .sort((a, b) => b.score - a.score);

    const bestPlatform = platformPerformance[0]?.platform || null;
    const worstPlatform = platformPerformance[platformPerformance.length - 1]?.platform || null;

    return {
      platformData,
      bestPerformingPlatform: bestPlatform,
      worstPerformingPlatform: worstPlatform,
      platformRankings: platformPerformance
    };
  }

  /**
   * Get performance metrics and KPIs
   */
  async getPerformanceMetrics(userId: string, dateRange?: DateRangeFilter): Promise<PerformanceMetrics> {
    const [contentStats, engagementStats] = await Promise.all([
      this.getContentGenerationStats(userId, dateRange),
      this.getEngagementStats(userId, dateRange)
    ]);

    // Calculate key performance indicators
    const contentVelocity = this.calculateContentVelocity(contentStats.contentByDate);
    const engagementGrowth = this.calculateEngagementGrowth(engagementStats.engagementByDate);
    const qualityTrend = contentStats.trend;
    const roi = this.calculateROI(contentStats, engagementStats);

    // Performance categories
    const overallPerformance = this.categorizeOverallPerformance(
      engagementStats.averageEngagementRate,
      engagementStats.averageClickThroughRate,
      contentStats.averageQualityScore
    );

    return {
      contentVelocity,
      engagementGrowth,
      qualityTrend,
      roi,
      overallPerformance,
      kpis: {
        contentProductivity: contentStats.totalContent,
        engagementEfficiency: engagementStats.averageEngagementRate,
        qualityConsistency: contentStats.averageQualityScore,
        platformDiversification: Object.keys(contentStats.platformBreakdown).length
      }
    };
  }

  /**
   * Get recent activity feed
   */
  async getRecentActivity(userId: string, limit: number = 10): Promise<ActivityItem[]> {
    const [recentContent, recentFeedback, recentIdeas] = await Promise.all([
      generatedContentService.getUserGeneratedContent(userId, limit),
      engagementFeedbackService.getUserFeedback(userId, limit),
      contentIdeaService.getUserContentIdeas(userId, limit)
    ]);

    const activities: ActivityItem[] = [];

    // Add content generation activities
    recentContent.forEach(content => {
      activities.push({
        id: `content-${content.contentId}`,
        type: 'content_generated',
        timestamp: content.createdAt,
        title: `Generated ${content.contentType} for ${content.platform}`,
        description: `Created ${content.metadata?.wordCount || 0} words of content`,
        metadata: {
          contentId: content.contentId,
          platform: content.platform,
          contentType: content.contentType,
          wordCount: content.metadata?.wordCount
        }
      });
    });

    // Add feedback activities
    recentFeedback.forEach(feedback => {
      const engagement = (feedback.metrics.likes || 0) + 
                        (feedback.metrics.shares || 0) + 
                        (feedback.metrics.comments || 0);
      
      activities.push({
        id: `feedback-${feedback.feedbackId}`,
        type: 'feedback_received',
        timestamp: feedback.timestamp,
        title: `Received engagement data for ${feedback.platform}`,
        description: `${engagement} total engagements with ${Math.round((feedback.metrics.engagementRate || 0) * 100)}% engagement rate`,
        metadata: {
          contentId: feedback.contentId,
          platform: feedback.platform,
          engagement,
          engagementRate: feedback.metrics.engagementRate
        }
      });
    });

    // Add idea submission activities
    recentIdeas.forEach(idea => {
      activities.push({
        id: `idea-${idea.ideaId}`,
        type: 'idea_submitted',
        timestamp: idea.createdAt,
        title: 'New content idea submitted',
        description: `"${idea.content.substring(0, 100)}${idea.content.length > 100 ? '...' : ''}"`,
        metadata: {
          ideaId: idea.ideaId,
          themes: idea.extractedThemes,
          intent: idea.intent
        }
      });
    });

    // Sort by timestamp (most recent first) and limit
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  /**
   * Generate insights and recommendations
   */
  async generateInsights(userId: string, dateRange?: DateRangeFilter): Promise<string[]> {
    const [contentStats, engagementStats, platformStats] = await Promise.all([
      this.getContentGenerationStats(userId, dateRange),
      this.getEngagementStats(userId, dateRange),
      this.getPlatformStats(userId, dateRange)
    ]);

    const insights: string[] = [];

    // Content generation insights
    if (contentStats.totalContent > 0) {
      if (contentStats.trend === 'increasing') {
        insights.push('Your content production is trending upward - great consistency!');
      } else if (contentStats.trend === 'decreasing') {
        insights.push('Consider increasing your content production frequency for better results');
      }

      if (contentStats.averageQualityScore >= 8) {
        insights.push('Your content quality is excellent - maintain these high standards');
      } else if (contentStats.averageQualityScore < 6) {
        insights.push('Focus on improving content quality for better engagement');
      }
    }

    // Engagement insights
    if (engagementStats.totalEngagement > 0) {
      if (engagementStats.averageEngagementRate >= 0.1) {
        insights.push('Your content achieves excellent engagement rates');
      } else if (engagementStats.averageEngagementRate < 0.02) {
        insights.push('Consider optimizing your content strategy to improve engagement');
      }

      if (engagementStats.engagementTrend === 'increasing') {
        insights.push('Your engagement is growing - keep up the great work!');
      }
    }

    // Platform insights
    if (platformStats.bestPerformingPlatform) {
      insights.push(`${platformStats.bestPerformingPlatform} is your best performing platform`);
    }

    if (platformStats.platformRankings.length > 1) {
      const topPlatform = platformStats.platformRankings[0];
      const bottomPlatform = platformStats.platformRankings[platformStats.platformRankings.length - 1];
      
      if (topPlatform.score > bottomPlatform.score * 2) {
        insights.push(`Consider focusing more effort on ${topPlatform.platform} where you see the best results`);
      }
    }

    // Content type insights
    const topContentType = Object.entries(contentStats.contentTypeBreakdown)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (topContentType) {
      insights.push(`${topContentType[0]} is your most frequently created content type`);
    }

    // Productivity insights
    if (contentStats.totalContent >= 50) {
      insights.push('You\'re a highly productive content creator!');
    } else if (contentStats.totalContent >= 20) {
      insights.push('Good content production volume - consider increasing frequency');
    }

    return insights.slice(0, 8); // Limit to top 8 insights
  }

  /**
   * Get user analytics summary for reporting
   */
  async getAnalyticsSummary(userId: string, period: 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<AnalyticsSummary> {
    const dateRange = this.getDateRangeForPeriod(period);
    const dashboardData = await this.getDashboardData(userId, dateRange);

    return {
      userId,
      period,
      dateRange,
      summary: {
        totalContent: dashboardData.contentStats.totalContent,
        totalEngagement: dashboardData.engagementStats.totalEngagement,
        averageEngagementRate: dashboardData.engagementStats.averageEngagementRate,
        bestPlatform: dashboardData.platformStats.bestPerformingPlatform,
        contentVelocity: dashboardData.performanceMetrics.contentVelocity,
        qualityScore: dashboardData.contentStats.averageQualityScore
      },
      highlights: dashboardData.insights.slice(0, 5),
      generatedAt: new Date().toISOString()
    };
  }

  // Helper methods

  private getDefaultDateRange(): DateRangeFilter {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Last 30 days

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  private getDateRangeForPeriod(period: 'week' | 'month' | 'quarter' | 'year'): DateRangeFilter {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  }

  private isWithinDateRange(dateString: string, dateRange: DateRangeFilter): boolean {
    const date = new Date(dateString);
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    return date >= start && date <= end;
  }

  private groupContentByDate(content: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    content.forEach(item => {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      grouped[date] = (grouped[date] || 0) + 1;
    });

    return grouped;
  }

  private groupEngagementByDate(feedback: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    
    feedback.forEach(item => {
      const date = new Date(item.timestamp).toISOString().split('T')[0];
      const engagement = (item.metrics.likes || 0) + (item.metrics.shares || 0) + (item.metrics.comments || 0);
      grouped[date] = (grouped[date] || 0) + engagement;
    });

    return grouped;
  }

  private calculateTrend(dataByDate: Record<string, number>): 'increasing' | 'decreasing' | 'stable' {
    const dates = Object.keys(dataByDate).sort();
    if (dates.length < 2) return 'stable';

    const midpoint = Math.floor(dates.length / 2);
    const firstHalf = dates.slice(0, midpoint);
    const secondHalf = dates.slice(midpoint);

    const firstHalfAvg = firstHalf.reduce((sum, date) => sum + dataByDate[date], 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, date) => sum + dataByDate[date], 0) / secondHalf.length;

    if (secondHalfAvg > firstHalfAvg * 1.1) return 'increasing';
    if (secondHalfAvg < firstHalfAvg * 0.9) return 'decreasing';
    return 'stable';
  }

  private calculateEngagementTrend(engagementByDate: Record<string, number>): 'increasing' | 'decreasing' | 'stable' {
    return this.calculateTrend(engagementByDate);
  }

  private async getTopPerformingContent(content: any[], limit: number): Promise<any[]> {
    // This would need to be enhanced to include engagement data
    return content
      .filter(c => c.metadata?.qualityScore)
      .sort((a, b) => (b.metadata?.qualityScore || 0) - (a.metadata?.qualityScore || 0))
      .slice(0, limit)
      .map(c => ({
        contentId: c.contentId,
        platform: c.platform,
        contentType: c.contentType,
        qualityScore: c.metadata?.qualityScore,
        wordCount: c.metadata?.wordCount,
        createdAt: c.createdAt
      }));
  }

  private async getBestPerformingContent(feedback: any[], limit: number): Promise<any[]> {
    return feedback
      .map(f => ({
        contentId: f.contentId,
        platform: f.platform,
        engagement: (f.metrics.likes || 0) + (f.metrics.shares || 0) + (f.metrics.comments || 0),
        engagementRate: f.metrics.engagementRate || 0,
        clickThroughRate: f.metrics.clickThroughRate || 0,
        timestamp: f.timestamp
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, limit);
  }

  private getEmptyEngagementStats(): EngagementStats {
    return {
      totalEngagement: 0,
      totalLikes: 0,
      totalShares: 0,
      totalComments: 0,
      totalImpressions: 0,
      totalReach: 0,
      averageEngagementRate: 0,
      averageClickThroughRate: 0,
      engagementByDate: {},
      engagementTrend: 'stable',
      bestPerformingContent: []
    };
  }

  private calculateContentVelocity(contentByDate: Record<string, number>): number {
    const dates = Object.keys(contentByDate).sort();
    if (dates.length === 0) return 0;

    const totalContent = Object.values(contentByDate).reduce((sum, count) => sum + count, 0);
    const daySpan = dates.length;
    
    return daySpan > 0 ? Math.round((totalContent / daySpan) * 10) / 10 : 0;
  }

  private calculateEngagementGrowth(engagementByDate: Record<string, number>): number {
    const dates = Object.keys(engagementByDate).sort();
    if (dates.length < 2) return 0;

    const firstValue = engagementByDate[dates[0]];
    const lastValue = engagementByDate[dates[dates.length - 1]];
    
    if (firstValue === 0) return lastValue > 0 ? 100 : 0;
    
    return Math.round(((lastValue - firstValue) / firstValue) * 100);
  }

  private calculateROI(contentStats: ContentGenerationStats, engagementStats: EngagementStats): number {
    // Simple ROI calculation based on engagement per content piece
    if (contentStats.totalContent === 0) return 0;
    
    const engagementPerContent = engagementStats.totalEngagement / contentStats.totalContent;
    return Math.round(engagementPerContent * 10) / 10;
  }

  private categorizeOverallPerformance(
    avgEngagementRate: number, 
    avgClickThroughRate: number, 
    avgQualityScore: number
  ): 'excellent' | 'good' | 'average' | 'needs_improvement' {
    const engagementScore = avgEngagementRate >= 0.1 ? 3 : avgEngagementRate >= 0.05 ? 2 : avgEngagementRate >= 0.02 ? 1 : 0;
    const ctrScore = avgClickThroughRate >= 0.05 ? 3 : avgClickThroughRate >= 0.02 ? 2 : avgClickThroughRate >= 0.01 ? 1 : 0;
    const qualityScore = avgQualityScore >= 8 ? 3 : avgQualityScore >= 6 ? 2 : avgQualityScore >= 4 ? 1 : 0;
    
    const totalScore = engagementScore + ctrScore + qualityScore;
    
    if (totalScore >= 8) return 'excellent';
    if (totalScore >= 6) return 'good';
    if (totalScore >= 3) return 'average';
    return 'needs_improvement';
  }
}

// Types for the analytics dashboard service

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface DashboardData {
  userId: string;
  dateRange: DateRangeFilter;
  contentStats: ContentGenerationStats;
  engagementStats: EngagementStats;
  platformStats: PlatformStats;
  performanceMetrics: PerformanceMetrics;
  recentActivity: ActivityItem[];
  insights: string[];
  generatedAt: string;
}

export interface ContentGenerationStats {
  totalContent: number;
  totalIdeas: number;
  totalWords: number;
  averageWordsPerContent: number;
  averageQualityScore: number;
  platformBreakdown: Record<Platform, number>;
  contentTypeBreakdown: Record<ContentType, number>;
  contentByDate: Record<string, number>;
  trend: 'increasing' | 'decreasing' | 'stable';
  topPerformingContent: any[];
}

export interface EngagementStats {
  totalEngagement: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;
  totalImpressions: number;
  totalReach: number;
  averageEngagementRate: number;
  averageClickThroughRate: number;
  engagementByDate: Record<string, number>;
  engagementTrend: 'increasing' | 'decreasing' | 'stable';
  bestPerformingContent: any[];
}

export interface PlatformStats {
  platformData: Record<Platform, PlatformMetrics>;
  bestPerformingPlatform: Platform | null;
  worstPerformingPlatform: Platform | null;
  platformRankings: Array<{
    platform: Platform;
    score: number;
    contentCount: number;
    totalEngagement: number;
    averageEngagementRate: number;
    averageClickThroughRate: number;
  }>;
}

export interface PlatformMetrics {
  contentCount: number;
  totalEngagement: number;
  averageEngagementRate: number;
  averageClickThroughRate: number;
  totalImpressions: number;
  totalReach: number;
  bestPerformingContent: any;
}

export interface PerformanceMetrics {
  contentVelocity: number;
  engagementGrowth: number;
  qualityTrend: 'increasing' | 'decreasing' | 'stable';
  roi: number;
  overallPerformance: 'excellent' | 'good' | 'average' | 'needs_improvement';
  kpis: {
    contentProductivity: number;
    engagementEfficiency: number;
    qualityConsistency: number;
    platformDiversification: number;
  };
}

export interface ActivityItem {
  id: string;
  type: 'content_generated' | 'feedback_received' | 'idea_submitted';
  timestamp: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
}

export interface AnalyticsSummary {
  userId: string;
  period: 'week' | 'month' | 'quarter' | 'year';
  dateRange: DateRangeFilter;
  summary: {
    totalContent: number;
    totalEngagement: number;
    averageEngagementRate: number;
    bestPlatform: Platform | null;
    contentVelocity: number;
    qualityScore: number;
  };
  highlights: string[];
  generatedAt: string;
}

// Export singleton instance
export const analyticsDashboardService = new AnalyticsDashboardService();
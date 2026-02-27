import { EngagementFeedback, EngagementMetrics, Platform } from '../types';
import { engagementFeedbackService, generatedContentService } from './database';

/**
 * Service for processing engagement feedback and generating insights
 */
export class FeedbackProcessingService {
  
  /**
   * Process and validate engagement feedback
   */
  async processFeedback(feedback: EngagementFeedback): Promise<ProcessedFeedback> {
    // Validate metrics
    const validationResult = this.validateMetrics(feedback.metrics);
    if (!validationResult.isValid) {
      throw new Error(`Invalid metrics: ${validationResult.errors.join(', ')}`);
    }

    // Get content information for context
    const content = await generatedContentService.getGeneratedContent(feedback.contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Calculate derived metrics
    const derivedMetrics = this.calculateDerivedMetrics(feedback.metrics, content);

    // Analyze performance
    const performanceAnalysis = this.analyzePerformance(feedback.metrics, feedback.platform);

    // Generate insights
    const insights = await this.generateInsights(feedback, content);

    return {
      feedback,
      content,
      derivedMetrics,
      performanceAnalysis,
      insights,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Validate engagement metrics
   */
  validateMetrics(metrics: EngagementMetrics): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    const requiredFields = ['likes', 'shares', 'comments', 'clickThroughRate', 'engagementRate'];
    for (const field of requiredFields) {
      if (!(field in metrics)) {
        errors.push(`Missing required field: ${field}`);
      } else {
        const value = metrics[field as keyof EngagementMetrics];
        if (typeof value !== 'number' || value < 0) {
          errors.push(`${field} must be a non-negative number`);
        }
      }
    }

    // Validate rate fields are between 0 and 1
    const rateFields = ['clickThroughRate', 'engagementRate'];
    for (const field of rateFields) {
      if (field in metrics) {
        const value = metrics[field as keyof EngagementMetrics];
        if (typeof value === 'number' && (value < 0 || value > 1)) {
          errors.push(`${field} must be between 0 and 1`);
        }
      }
    }

    // Validate optional fields
    const optionalFields = ['impressions', 'reach'];
    for (const field of optionalFields) {
      if (field in metrics) {
        const value = metrics[field as keyof EngagementMetrics];
        if (typeof value !== 'number' || value < 0) {
          errors.push(`${field} must be a non-negative number if provided`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate derived metrics from engagement data
   */
  calculateDerivedMetrics(metrics: EngagementMetrics, content: any): DerivedMetrics {
    const totalEngagement = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
    const impressions = metrics.impressions || 0;
    const reach = metrics.reach || 0;

    // Calculate engagement per impression/reach
    const engagementPerImpression = impressions > 0 ? totalEngagement / impressions : 0;
    const engagementPerReach = reach > 0 ? totalEngagement / reach : 0;

    // Calculate weighted engagement score
    const engagementScore = this.calculateEngagementScore(metrics);

    // Calculate virality coefficient (shares / total engagement)
    const viralityCoefficient = totalEngagement > 0 ? (metrics.shares || 0) / totalEngagement : 0;

    // Calculate interaction depth (comments / likes ratio)
    const interactionDepth = (metrics.likes || 0) > 0 ? (metrics.comments || 0) / (metrics.likes || 0) : 0;

    // Content-specific metrics
    const wordCount = content.metadata?.wordCount || 0;
    const engagementPerWord = wordCount > 0 ? totalEngagement / wordCount : 0;

    return {
      totalEngagement,
      engagementScore,
      viralityCoefficient,
      interactionDepth,
      engagementPerImpression,
      engagementPerReach,
      engagementPerWord,
      performanceCategory: this.categorizePerformance(metrics),
      qualityScore: this.calculateQualityScore(metrics, content)
    };
  }

  /**
   * Calculate weighted engagement score
   */
  private calculateEngagementScore(metrics: EngagementMetrics): number {
    const weights = {
      likes: 1,
      shares: 3,      // Shares are more valuable
      comments: 2,    // Comments show deeper engagement
      clickThroughRate: 5,  // CTR is highly valuable
      engagementRate: 4     // Overall engagement rate
    };

    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([metric, weight]) => {
      const value = metrics[metric as keyof EngagementMetrics];
      if (typeof value === 'number') {
        weightedSum += value * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Categorize performance level
   */
  private categorizePerformance(metrics: EngagementMetrics): PerformanceCategory {
    const engagementRate = metrics.engagementRate || 0;
    const clickThroughRate = metrics.clickThroughRate || 0;

    if (engagementRate >= 0.15 || clickThroughRate >= 0.08) {
      return 'exceptional';
    } else if (engagementRate >= 0.1 || clickThroughRate >= 0.05) {
      return 'high';
    } else if (engagementRate >= 0.05 || clickThroughRate >= 0.02) {
      return 'medium';
    } else if (engagementRate >= 0.02 || clickThroughRate >= 0.01) {
      return 'low';
    } else {
      return 'poor';
    }
  }

  /**
   * Calculate content quality score based on engagement patterns
   */
  private calculateQualityScore(metrics: EngagementMetrics, content: any): number {
    let score = 0;
    let factors = 0;

    // Engagement rate factor (0-40 points)
    const engagementRate = metrics.engagementRate || 0;
    score += Math.min(engagementRate * 400, 40);
    factors++;

    // Click-through rate factor (0-30 points)
    const clickThroughRate = metrics.clickThroughRate || 0;
    score += Math.min(clickThroughRate * 600, 30);
    factors++;

    // Interaction depth factor (0-20 points)
    const likes = metrics.likes || 0;
    const comments = metrics.comments || 0;
    const interactionDepth = likes > 0 ? comments / likes : 0;
    score += Math.min(interactionDepth * 100, 20);
    factors++;

    // Virality factor (0-10 points)
    const totalEngagement = likes + (metrics.shares || 0) + comments;
    const shares = metrics.shares || 0;
    const virality = totalEngagement > 0 ? shares / totalEngagement : 0;
    score += Math.min(virality * 100, 10);
    factors++;

    return factors > 0 ? Math.round(score / factors * 10) / 10 : 0;
  }

  /**
   * Analyze performance against platform benchmarks
   */
  analyzePerformance(metrics: EngagementMetrics, platform: Platform): PerformanceAnalysis {
    const benchmarks = this.getPlatformBenchmarks(platform);
    
    const analysis: PerformanceAnalysis = {
      platform,
      benchmarkComparison: {},
      strengths: [],
      weaknesses: [],
      recommendations: []
    };

    // Compare against benchmarks
    Object.entries(benchmarks).forEach(([metric, benchmark]) => {
      const value = metrics[metric as keyof EngagementMetrics] || 0;
      const ratio = benchmark > 0 ? value / benchmark : 0;
      
      analysis.benchmarkComparison[metric] = {
        value,
        benchmark,
        ratio,
        performance: ratio >= 1.2 ? 'above' : ratio >= 0.8 ? 'at' : 'below'
      };

      // Identify strengths and weaknesses
      if (ratio >= 1.2) {
        analysis.strengths.push(`${metric} is ${Math.round((ratio - 1) * 100)}% above platform average`);
      } else if (ratio < 0.8) {
        analysis.weaknesses.push(`${metric} is ${Math.round((1 - ratio) * 100)}% below platform average`);
      }
    });

    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis, platform);

    return analysis;
  }

  /**
   * Get platform-specific benchmarks
   */
  private getPlatformBenchmarks(platform: Platform): Record<string, number> {
    const benchmarks: Record<Platform, Record<string, number>> = {
      'blog': {
        engagementRate: 0.02,
        clickThroughRate: 0.025,
        likes: 10,
        shares: 3,
        comments: 2
      },
      'twitter': {
        engagementRate: 0.045,
        clickThroughRate: 0.015,
        likes: 15,
        shares: 5,
        comments: 3
      },
      'facebook': {
        engagementRate: 0.063,
        clickThroughRate: 0.012,
        likes: 25,
        shares: 8,
        comments: 5
      },
      'instagram': {
        engagementRate: 0.083,
        clickThroughRate: 0.008,
        likes: 50,
        shares: 12,
        comments: 8
      },
      'linkedin': {
        engagementRate: 0.054,
        clickThroughRate: 0.022,
        likes: 20,
        shares: 6,
        comments: 4
      },
      'youtube': {
        engagementRate: 0.068,
        clickThroughRate: 0.045,
        likes: 100,
        shares: 15,
        comments: 25
      },
      'tiktok': {
        engagementRate: 0.175,
        clickThroughRate: 0.006,
        likes: 200,
        shares: 50,
        comments: 30
      }
    };

    return benchmarks[platform] || benchmarks['blog'];
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(analysis: PerformanceAnalysis, platform: Platform): string[] {
    const recommendations: string[] = [];

    // Platform-specific recommendations
    const platformRecommendations: Record<Platform, string[]> = {
      'blog': [
        'Optimize for SEO to increase organic reach',
        'Include compelling call-to-action buttons',
        'Add social sharing buttons to increase shares'
      ],
      'twitter': [
        'Use trending hashtags to increase visibility',
        'Post during peak engagement hours (9-10 AM, 7-9 PM)',
        'Include images or videos to boost engagement'
      ],
      'facebook': [
        'Post when your audience is most active',
        'Use Facebook Stories for additional engagement',
        'Encourage comments with questions or polls'
      ],
      'instagram': [
        'Use high-quality visuals and consistent aesthetic',
        'Leverage Instagram Stories and Reels',
        'Use relevant hashtags (5-10 per post)'
      ],
      'linkedin': [
        'Share industry insights and professional content',
        'Engage with comments promptly',
        'Post during business hours for better reach'
      ],
      'youtube': [
        'Optimize video titles and thumbnails',
        'Include clear call-to-actions in videos',
        'Engage with comments to boost algorithm ranking'
      ],
      'tiktok': [
        'Follow trending sounds and challenges',
        'Post consistently (1-3 times per day)',
        'Use trending hashtags and participate in challenges'
      ]
    };

    // Add platform-specific recommendations
    recommendations.push(...(platformRecommendations[platform] || []));

    // Add performance-based recommendations
    if (analysis.benchmarkComparison.engagementRate?.performance === 'below') {
      recommendations.push('Focus on creating more engaging content that encourages interaction');
    }

    if (analysis.benchmarkComparison.clickThroughRate?.performance === 'below') {
      recommendations.push('Improve call-to-action clarity and placement');
    }

    if (analysis.benchmarkComparison.shares?.performance === 'below') {
      recommendations.push('Create more shareable content with emotional appeal or practical value');
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  /**
   * Generate insights from feedback data
   */
  async generateInsights(feedback: EngagementFeedback, content: any): Promise<string[]> {
    const insights: string[] = [];

    // Performance insights
    const performanceCategory = this.categorizePerformance(feedback.metrics);
    insights.push(`This content achieved ${performanceCategory} performance on ${feedback.platform}`);

    // Engagement pattern insights
    const totalEngagement = (feedback.metrics.likes || 0) + 
                           (feedback.metrics.shares || 0) + 
                           (feedback.metrics.comments || 0);
    
    if (feedback.metrics.shares && feedback.metrics.shares > totalEngagement * 0.3) {
      insights.push('High share rate indicates strong viral potential');
    }

    if (feedback.metrics.comments && feedback.metrics.comments > totalEngagement * 0.2) {
      insights.push('High comment rate shows strong audience engagement and discussion');
    }

    // Content-specific insights
    if (content.metadata?.hashtags?.length > 0) {
      insights.push(`Content used ${content.metadata.hashtags.length} hashtags`);
    }

    if (content.metadata?.wordCount) {
      const engagementPerWord = totalEngagement / content.metadata.wordCount;
      if (engagementPerWord > 0.1) {
        insights.push('High engagement per word indicates concise, impactful content');
      }
    }

    // Time-based insights
    const postTime = new Date(feedback.timestamp);
    const hour = postTime.getHours();
    if (hour >= 9 && hour <= 11) {
      insights.push('Posted during peak morning engagement hours');
    } else if (hour >= 19 && hour <= 21) {
      insights.push('Posted during peak evening engagement hours');
    }

    return insights;
  }

  /**
   * Get user's feedback summary
   */
  async getUserFeedbackSummary(userId: string, days: number = 30): Promise<FeedbackSummary> {
    const feedbackData = await engagementFeedbackService.getUserFeedback(userId, 1000);
    
    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const recentFeedback = feedbackData.filter(f => 
      new Date(f.timestamp) >= cutoffDate
    );

    if (recentFeedback.length === 0) {
      return {
        userId,
        period: `${days} days`,
        totalContent: 0,
        totalEngagement: 0,
        averageEngagementRate: 0,
        averageClickThroughRate: 0,
        platformBreakdown: {},
        topPerformingContent: [],
        insights: ['No engagement data available for this period']
      };
    }

    // Calculate summary metrics
    let totalEngagement = 0;
    let totalEngagementRate = 0;
    let totalClickThroughRate = 0;
    const platformStats: Record<string, any> = {};
    const contentPerformance: Record<string, any> = {};

    recentFeedback.forEach(feedback => {
      const metrics = feedback.metrics;
      const engagement = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
      
      totalEngagement += engagement;
      totalEngagementRate += metrics.engagementRate || 0;
      totalClickThroughRate += metrics.clickThroughRate || 0;

      // Platform stats
      if (!platformStats[feedback.platform]) {
        platformStats[feedback.platform] = {
          count: 0,
          totalEngagement: 0,
          avgEngagementRate: 0,
          avgClickThroughRate: 0
        };
      }
      platformStats[feedback.platform].count++;
      platformStats[feedback.platform].totalEngagement += engagement;
      platformStats[feedback.platform].avgEngagementRate += metrics.engagementRate || 0;
      platformStats[feedback.platform].avgClickThroughRate += metrics.clickThroughRate || 0;

      // Content performance
      if (!contentPerformance[feedback.contentId] || 
          contentPerformance[feedback.contentId].engagement < engagement) {
        contentPerformance[feedback.contentId] = {
          contentId: feedback.contentId,
          platform: feedback.platform,
          engagement,
          engagementRate: metrics.engagementRate || 0,
          timestamp: feedback.timestamp
        };
      }
    });

    // Calculate averages
    const count = recentFeedback.length;
    Object.keys(platformStats).forEach(platform => {
      const stats = platformStats[platform];
      stats.avgEngagementRate /= stats.count;
      stats.avgClickThroughRate /= stats.count;
    });

    const topPerformingContent = Object.values(contentPerformance)
      .sort((a: any, b: any) => b.engagement - a.engagement)
      .slice(0, 5);

    return {
      userId,
      period: `${days} days`,
      totalContent: recentFeedback.length,
      totalEngagement,
      averageEngagementRate: totalEngagementRate / count,
      averageClickThroughRate: totalClickThroughRate / count,
      platformBreakdown: platformStats,
      topPerformingContent,
      insights: await this.generateSummaryInsights(recentFeedback, platformStats)
    };
  }

  /**
   * Generate summary insights
   */
  private async generateSummaryInsights(feedbackData: any[], platformStats: Record<string, any>): Promise<string[]> {
    const insights: string[] = [];

    // Best performing platform
    let bestPlatform = '';
    let bestScore = -1;
    Object.entries(platformStats).forEach(([platform, stats]: [string, any]) => {
      const score = stats.avgEngagementRate + stats.avgClickThroughRate;
      if (score > bestScore) {
        bestScore = score;
        bestPlatform = platform;
      }
    });

    if (bestPlatform) {
      insights.push(`Your content performs best on ${bestPlatform}`);
    }

    // Overall performance trend
    const avgEngagementRate = feedbackData.reduce((sum, f) => 
      sum + (f.metrics.engagementRate || 0), 0) / feedbackData.length;
    
    if (avgEngagementRate >= 0.1) {
      insights.push('Your content consistently achieves high engagement rates');
    } else if (avgEngagementRate >= 0.05) {
      insights.push('Your content achieves good engagement rates');
    } else {
      insights.push('Consider optimizing content for better engagement');
    }

    // Content volume insight
    if (feedbackData.length >= 20) {
      insights.push('High content volume - consistent posting strategy');
    } else if (feedbackData.length >= 10) {
      insights.push('Moderate content volume - consider increasing posting frequency');
    } else {
      insights.push('Low content volume - increase posting frequency for better insights');
    }

    return insights;
  }
}

// Types for the service
export interface ProcessedFeedback {
  feedback: EngagementFeedback;
  content: any;
  derivedMetrics: DerivedMetrics;
  performanceAnalysis: PerformanceAnalysis;
  insights: string[];
  processedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface DerivedMetrics {
  totalEngagement: number;
  engagementScore: number;
  viralityCoefficient: number;
  interactionDepth: number;
  engagementPerImpression: number;
  engagementPerReach: number;
  engagementPerWord: number;
  performanceCategory: PerformanceCategory;
  qualityScore: number;
}

export type PerformanceCategory = 'exceptional' | 'high' | 'medium' | 'low' | 'poor';

export interface PerformanceAnalysis {
  platform: Platform;
  benchmarkComparison: Record<string, {
    value: number;
    benchmark: number;
    ratio: number;
    performance: 'above' | 'at' | 'below';
  }>;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface FeedbackSummary {
  userId: string;
  period: string;
  totalContent: number;
  totalEngagement: number;
  averageEngagementRate: number;
  averageClickThroughRate: number;
  platformBreakdown: Record<string, any>;
  topPerformingContent: any[];
  insights: string[];
}

// Export singleton instance
export const feedbackProcessingService = new FeedbackProcessingService();
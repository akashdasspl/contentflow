import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { openSearchService } from '../../services/opensearch-service';
import { feedbackProcessingService } from '../../services/feedback-processing';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to retrieve user's content insights and recommendations
 * Provides advanced analytics and actionable insights from engagement data
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get insights request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const platform = queryParams.platform;
    const dateFrom = queryParams.dateFrom;
    const dateTo = queryParams.dateTo;
    const timeInterval = queryParams.timeInterval || 'day';
    const insightType = queryParams.type || 'comprehensive';

    // Validate date range
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      return createResponse(400, { 
        error: 'Invalid date range. dateFrom must be before dateTo.' 
      });
    }

    // Get insights based on type
    let insights: any = {};

    switch (insightType) {
      case 'comprehensive':
        insights = await getComprehensiveInsights(authResult.userId, {
          platform,
          dateFrom,
          dateTo,
          timeInterval
        });
        break;

      case 'performance':
        insights = await getPerformanceInsights(authResult.userId, {
          platform,
          dateFrom,
          dateTo
        });
        break;

      case 'trends':
        insights = await getTrendInsights(authResult.userId, {
          platform,
          dateFrom,
          dateTo
        });
        break;

      case 'recommendations':
        insights = await getRecommendations(authResult.userId, {
          platform,
          dateFrom,
          dateTo
        });
        break;

      default:
        return createResponse(400, { 
          error: 'Invalid insight type. Must be one of: comprehensive, performance, trends, recommendations' 
        });
    }

    return createResponse(200, {
      userId: authResult.userId,
      insightType,
      filters: {
        platform: platform || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        timeInterval
      },
      generatedAt: new Date().toISOString(),
      ...insights
    });

  } catch (error) {
    console.error('Error retrieving insights:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve insights'
    });
  }
};

/**
 * Get comprehensive insights combining all analytics
 */
async function getComprehensiveInsights(userId: string, options: any): Promise<any> {
  try {
    // Get OpenSearch insights
    const openSearchInsights = await openSearchService.getUserInsights(userId, options);
    
    // Get feedback summary from processing service
    const days = options.dateFrom && options.dateTo ? 
      Math.ceil((new Date(options.dateTo).getTime() - new Date(options.dateFrom).getTime()) / (1000 * 60 * 60 * 24)) : 
      30;
    
    const feedbackSummary = await feedbackProcessingService.getUserFeedbackSummary(userId, days);

    // Combine insights
    return {
      summary: {
        totalContent: feedbackSummary.totalContent,
        totalEngagement: feedbackSummary.totalEngagement,
        averageEngagementRate: feedbackSummary.averageEngagementRate,
        averageClickThroughRate: feedbackSummary.averageClickThroughRate,
        period: feedbackSummary.period
      },
      platformPerformance: openSearchInsights.platformPerformance,
      contentTypePerformance: openSearchInsights.contentTypePerformance,
      performanceOverTime: openSearchInsights.performanceOverTime,
      topHashtags: openSearchInsights.topHashtags,
      bestPostingHours: openSearchInsights.bestPostingHours,
      performanceDistribution: openSearchInsights.performanceDistribution,
      topPerformingContent: feedbackSummary.topPerformingContent,
      insights: [
        ...openSearchInsights.insights,
        ...feedbackSummary.insights
      ],
      recommendations: await generateSmartRecommendations(openSearchInsights, feedbackSummary)
    };

  } catch (error) {
    console.error('Error getting comprehensive insights:', error);
    throw error;
  }
}

/**
 * Get performance-focused insights
 */
async function getPerformanceInsights(userId: string, options: any): Promise<any> {
  try {
    const insights = await openSearchService.getUserInsights(userId, options);
    
    // Calculate performance scores
    const performanceScores = calculatePerformanceScores(insights.platformPerformance);
    
    // Identify top and bottom performers
    const topPerformer = performanceScores.reduce((max, current) => 
      current.score > max.score ? current : max, performanceScores[0]);
    
    const bottomPerformer = performanceScores.reduce((min, current) => 
      current.score < min.score ? current : min, performanceScores[0]);

    return {
      performanceScores,
      topPerformer,
      bottomPerformer,
      platformComparison: insights.platformPerformance,
      performanceDistribution: insights.performanceDistribution,
      performanceTrends: insights.performanceOverTime,
      insights: generatePerformanceInsights(performanceScores, insights)
    };

  } catch (error) {
    console.error('Error getting performance insights:', error);
    throw error;
  }
}

/**
 * Get trend-focused insights
 */
async function getTrendInsights(userId: string, options: any): Promise<any> {
  try {
    const insights = await openSearchService.getUserInsights(userId, options);
    const trendingPatterns = await openSearchService.getTrendingPatterns(options);
    
    // Analyze trends
    const trends = analyzeTrends(insights.performanceOverTime);
    
    return {
      overallTrend: trends.overall,
      platformTrends: trends.byPlatform,
      performanceOverTime: insights.performanceOverTime,
      trendingHashtags: trendingPatterns.trendingHashtags.slice(0, 10),
      seasonalPatterns: identifySeasonalPatterns(insights.performanceOverTime),
      insights: generateTrendInsights(trends, trendingPatterns)
    };

  } catch (error) {
    console.error('Error getting trend insights:', error);
    throw error;
  }
}

/**
 * Get actionable recommendations
 */
async function getRecommendations(userId: string, options: any): Promise<any> {
  try {
    const insights = await openSearchService.getUserInsights(userId, options);
    const feedbackSummary = await feedbackProcessingService.getUserFeedbackSummary(userId, 30);
    
    // Generate different types of recommendations
    const contentRecommendations = generateContentRecommendations(insights, feedbackSummary);
    const timingRecommendations = generateTimingRecommendations(insights);
    const platformRecommendations = generatePlatformRecommendations(insights);
    const hashtagRecommendations = generateHashtagRecommendations(insights);
    
    return {
      contentRecommendations,
      timingRecommendations,
      platformRecommendations,
      hashtagRecommendations,
      priorityActions: identifyPriorityActions(insights, feedbackSummary),
      quickWins: identifyQuickWins(insights, feedbackSummary)
    };

  } catch (error) {
    console.error('Error getting recommendations:', error);
    throw error;
  }
}

/**
 * Calculate performance scores for platforms
 */
function calculatePerformanceScores(platformPerformance: any[]): any[] {
  return platformPerformance.map(platform => ({
    platform: platform.platform,
    score: (platform.avgEngagementRate * 0.4) + 
           (platform.avgClickThroughRate * 0.4) + 
           (platform.avgQualityScore * 0.2),
    engagementRate: platform.avgEngagementRate,
    clickThroughRate: platform.avgClickThroughRate,
    qualityScore: platform.avgQualityScore,
    contentCount: platform.count
  })).sort((a, b) => b.score - a.score);
}

/**
 * Generate smart recommendations based on insights
 */
async function generateSmartRecommendations(openSearchInsights: any, feedbackSummary: any): Promise<string[]> {
  const recommendations: string[] = [];

  // Platform recommendations
  if (openSearchInsights.platformPerformance.length > 1) {
    const bestPlatform = openSearchInsights.platformPerformance
      .sort((a: any, b: any) => b.avgEngagementRate - a.avgEngagementRate)[0];
    recommendations.push(`Focus more content on ${bestPlatform.platform} - it's your highest performing platform`);
  }

  // Timing recommendations
  if (openSearchInsights.bestPostingHours.length > 0) {
    const bestHour = openSearchInsights.bestPostingHours[0];
    recommendations.push(`Post more content around ${bestHour.hour}:00 for optimal engagement`);
  }

  // Hashtag recommendations
  if (openSearchInsights.topHashtags.length > 0) {
    const topHashtag = openSearchInsights.topHashtags[0];
    recommendations.push(`Continue using #${topHashtag.hashtag} - it's your most effective hashtag`);
  }

  // Performance improvement recommendations
  if (feedbackSummary.averageEngagementRate < 0.05) {
    recommendations.push('Focus on creating more engaging content with questions, polls, or interactive elements');
  }

  if (feedbackSummary.averageClickThroughRate < 0.02) {
    recommendations.push('Improve your call-to-action clarity and placement to increase click-through rates');
  }

  return recommendations.slice(0, 5);
}

/**
 * Generate performance-specific insights
 */
function generatePerformanceInsights(performanceScores: any[], insights: any): string[] {
  const performanceInsights: string[] = [];

  if (performanceScores.length > 0) {
    const topPlatform = performanceScores[0];
    performanceInsights.push(`${topPlatform.platform} is your top performing platform with a score of ${topPlatform.score.toFixed(2)}`);
    
    if (performanceScores.length > 1) {
      const improvement = ((topPlatform.score - performanceScores[performanceScores.length - 1].score) / performanceScores[performanceScores.length - 1].score * 100);
      performanceInsights.push(`Your best platform performs ${improvement.toFixed(1)}% better than your worst`);
    }
  }

  // Performance distribution insights
  const highPerformance = insights.performanceDistribution.find((p: any) => p.category === 'high')?.count || 0;
  const totalContent = insights.performanceDistribution.reduce((sum: number, p: any) => sum + p.count, 0);
  
  if (totalContent > 0) {
    const highPerformanceRate = (highPerformance / totalContent) * 100;
    performanceInsights.push(`${highPerformanceRate.toFixed(1)}% of your content achieves high performance`);
  }

  return performanceInsights;
}

/**
 * Analyze trends from performance over time data
 */
function analyzeTrends(performanceOverTime: any[]): any {
  if (performanceOverTime.length < 2) {
    return {
      overall: 'insufficient_data',
      byPlatform: {}
    };
  }

  // Calculate overall trend
  const firstHalf = performanceOverTime.slice(0, Math.floor(performanceOverTime.length / 2));
  const secondHalf = performanceOverTime.slice(Math.floor(performanceOverTime.length / 2));

  const firstHalfAvg = firstHalf.reduce((sum, p) => sum + p.avgEngagementRate, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, p) => sum + p.avgEngagementRate, 0) / secondHalf.length;

  const overallTrend = secondHalfAvg > firstHalfAvg * 1.1 ? 'improving' :
                      secondHalfAvg < firstHalfAvg * 0.9 ? 'declining' : 'stable';

  return {
    overall: overallTrend,
    firstHalfAvg,
    secondHalfAvg,
    changePercent: ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(1),
    byPlatform: {} // Could be expanded to analyze per-platform trends
  };
}

/**
 * Generate trend-specific insights
 */
function generateTrendInsights(trends: any, trendingPatterns: any): string[] {
  const trendInsights: string[] = [];

  // Overall trend insight
  if (trends.overall === 'improving') {
    trendInsights.push(`Your content performance is improving - ${trends.changePercent}% increase in engagement`);
  } else if (trends.overall === 'declining') {
    trendInsights.push(`Your content performance is declining - ${Math.abs(trends.changePercent)}% decrease in engagement`);
  } else {
    trendInsights.push('Your content performance is stable over time');
  }

  // Trending hashtags insight
  if (trendingPatterns.trendingHashtags.length > 0) {
    const topTrending = trendingPatterns.trendingHashtags[0];
    trendInsights.push(`#${topTrending.hashtag} is trending with high engagement potential`);
  }

  return trendInsights;
}

/**
 * Identify seasonal patterns
 */
function identifySeasonalPatterns(performanceOverTime: any[]): any {
  // Simple pattern detection - could be enhanced with more sophisticated analysis
  const patterns = {
    weeklyPattern: 'unknown',
    monthlyPattern: 'unknown',
    insights: []
  };

  if (performanceOverTime.length >= 7) {
    // Analyze weekly patterns
    const weeklyAvg = performanceOverTime.slice(-7).reduce((sum, p) => sum + p.avgEngagementRate, 0) / 7;
    const overallAvg = performanceOverTime.reduce((sum, p) => sum + p.avgEngagementRate, 0) / performanceOverTime.length;
    
    if (weeklyAvg > overallAvg * 1.1) {
      patterns.weeklyPattern = 'recent_improvement';
      patterns.insights.push('Recent week shows improved performance');
    } else if (weeklyAvg < overallAvg * 0.9) {
      patterns.weeklyPattern = 'recent_decline';
      patterns.insights.push('Recent week shows declining performance');
    }
  }

  return patterns;
}

/**
 * Generate content recommendations
 */
function generateContentRecommendations(insights: any, feedbackSummary: any): string[] {
  const recommendations: string[] = [];

  // Content type recommendations
  if (insights.contentTypePerformance.length > 0) {
    const bestContentType = insights.contentTypePerformance
      .sort((a: any, b: any) => b.avgEngagementRate - a.avgEngagementRate)[0];
    recommendations.push(`Create more ${bestContentType.contentType} content - it performs best for you`);
  }

  // Quality recommendations
  if (feedbackSummary.averageEngagementRate < 0.05) {
    recommendations.push('Focus on creating more interactive content with questions and polls');
    recommendations.push('Use storytelling techniques to increase emotional engagement');
  }

  return recommendations;
}

/**
 * Generate timing recommendations
 */
function generateTimingRecommendations(insights: any): string[] {
  const recommendations: string[] = [];

  if (insights.bestPostingHours.length >= 3) {
    const topHours = insights.bestPostingHours.slice(0, 3);
    recommendations.push(`Best posting times: ${topHours.map((h: any) => `${h.hour}:00`).join(', ')}`);
  }

  return recommendations;
}

/**
 * Generate platform recommendations
 */
function generatePlatformRecommendations(insights: any): string[] {
  const recommendations: string[] = [];

  if (insights.platformPerformance.length > 1) {
    const sorted = insights.platformPerformance
      .sort((a: any, b: any) => b.avgEngagementRate - a.avgEngagementRate);
    
    recommendations.push(`Prioritize ${sorted[0].platform} - highest engagement rate`);
    
    if (sorted.length > 2) {
      recommendations.push(`Consider reducing focus on ${sorted[sorted.length - 1].platform} - lowest performance`);
    }
  }

  return recommendations;
}

/**
 * Generate hashtag recommendations
 */
function generateHashtagRecommendations(insights: any): string[] {
  const recommendations: string[] = [];

  if (insights.topHashtags.length > 0) {
    const topHashtags = insights.topHashtags.slice(0, 5);
    recommendations.push(`Top performing hashtags: ${topHashtags.map((h: any) => `#${h.hashtag}`).join(', ')}`);
  }

  return recommendations;
}

/**
 * Identify priority actions
 */
function identifyPriorityActions(insights: any, feedbackSummary: any): string[] {
  const actions: string[] = [];

  // Low engagement rate - high priority
  if (feedbackSummary.averageEngagementRate < 0.02) {
    actions.push('URGENT: Improve content engagement - current rate is below industry standards');
  }

  // No content in best performing platform
  if (insights.platformPerformance.length > 0) {
    const bestPlatform = insights.platformPerformance[0];
    if (bestPlatform.count < 5) {
      actions.push(`HIGH: Increase content volume on ${bestPlatform.platform} - your best performing platform`);
    }
  }

  return actions;
}

/**
 * Identify quick wins
 */
function identifyQuickWins(insights: any, feedbackSummary: any): string[] {
  const quickWins: string[] = [];

  // Post at optimal times
  if (insights.bestPostingHours.length > 0) {
    quickWins.push(`Post at ${insights.bestPostingHours[0].hour}:00 for immediate engagement boost`);
  }

  // Use top hashtags
  if (insights.topHashtags.length > 0) {
    quickWins.push(`Use #${insights.topHashtags[0].hashtag} in your next post`);
  }

  return quickWins;
}
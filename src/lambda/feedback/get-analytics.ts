import { APIGatewayEvent, APIGatewayResponse } from '../../types';
import { engagementFeedbackService } from '../../services/database';
import { validateToken, createResponse } from '../../utils';

/**
 * Lambda function to retrieve user's feedback analytics
 * Provides performance metrics and insights from engagement data
 */
export const handler = async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
  try {
    console.log('Get analytics request:', JSON.stringify(event, null, 2));

    // Validate authentication
    const authResult = await validateToken(event.headers.Authorization || '');
    if (!authResult.isValid || !authResult.userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit) : 50;
    const platform = queryParams.platform;
    const contentType = queryParams.contentType;
    const dateFrom = queryParams.dateFrom;
    const dateTo = queryParams.dateTo;

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return createResponse(400, { 
        error: 'Invalid limit parameter. Must be between 1 and 1000.' 
      });
    }

    // Get user's feedback data
    const feedbackData = await engagementFeedbackService.getUserFeedback(
      authResult.userId, 
      limit
    );

    // Filter by date range if provided
    let filteredData = feedbackData;
    if (dateFrom || dateTo) {
      filteredData = filterByDateRange(feedbackData, dateFrom, dateTo);
    }

    // Filter by platform if provided
    if (platform) {
      filteredData = filteredData.filter(f => f.platform === platform);
    }

    // Calculate analytics
    const analytics = calculateAnalytics(filteredData);

    // Get OpenSearch insights if available
    const insights = await getOpenSearchInsights(authResult.userId, {
      platform,
      contentType,
      dateFrom,
      dateTo
    });

    return createResponse(200, {
      userId: authResult.userId,
      totalFeedback: filteredData.length,
      dateRange: {
        from: dateFrom || null,
        to: dateTo || null
      },
      filters: {
        platform: platform || null,
        contentType: contentType || null
      },
      analytics,
      insights,
      data: filteredData
    });

  } catch (error) {
    console.error('Error retrieving analytics:', error);
    return createResponse(500, { 
      error: 'Internal server error',
      message: 'Failed to retrieve analytics'
    });
  }
};

/**
 * Filter feedback data by date range
 */
function filterByDateRange(data: any[], dateFrom?: string, dateTo?: string): any[] {
  return data.filter(feedback => {
    const feedbackDate = new Date(feedback.timestamp);
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      if (feedbackDate < fromDate) return false;
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      if (feedbackDate > toDate) return false;
    }
    
    return true;
  });
}

/**
 * Calculate analytics from feedback data
 */
function calculateAnalytics(feedbackData: any[]): any {
  if (feedbackData.length === 0) {
    return {
      totalEngagement: 0,
      averageEngagementRate: 0,
      averageClickThroughRate: 0,
      platformBreakdown: {},
      topPerformingContent: [],
      trends: {
        engagement: 'stable',
        clickThrough: 'stable'
      }
    };
  }

  // Calculate totals and averages
  let totalLikes = 0;
  let totalShares = 0;
  let totalComments = 0;
  let totalEngagementRate = 0;
  let totalClickThroughRate = 0;
  let totalImpressions = 0;
  let totalReach = 0;

  const platformStats: Record<string, any> = {};
  const contentPerformance: Record<string, any> = {};

  feedbackData.forEach(feedback => {
    const metrics = feedback.metrics;
    
    // Accumulate totals
    totalLikes += metrics.likes || 0;
    totalShares += metrics.shares || 0;
    totalComments += metrics.comments || 0;
    totalEngagementRate += metrics.engagementRate || 0;
    totalClickThroughRate += metrics.clickThroughRate || 0;
    totalImpressions += metrics.impressions || 0;
    totalReach += metrics.reach || 0;

    // Platform breakdown
    if (!platformStats[feedback.platform]) {
      platformStats[feedback.platform] = {
        count: 0,
        totalEngagement: 0,
        totalEngagementRate: 0,
        totalClickThroughRate: 0
      };
    }
    
    platformStats[feedback.platform].count++;
    platformStats[feedback.platform].totalEngagement += 
      (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
    platformStats[feedback.platform].totalEngagementRate += metrics.engagementRate || 0;
    platformStats[feedback.platform].totalClickThroughRate += metrics.clickThroughRate || 0;

    // Content performance tracking
    const contentEngagement = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
    if (!contentPerformance[feedback.contentId] || 
        contentPerformance[feedback.contentId].engagement < contentEngagement) {
      contentPerformance[feedback.contentId] = {
        contentId: feedback.contentId,
        platform: feedback.platform,
        engagement: contentEngagement,
        engagementRate: metrics.engagementRate || 0,
        clickThroughRate: metrics.clickThroughRate || 0,
        timestamp: feedback.timestamp
      };
    }
  });

  // Calculate averages
  const count = feedbackData.length;
  const averageEngagementRate = totalEngagementRate / count;
  const averageClickThroughRate = totalClickThroughRate / count;

  // Calculate platform averages
  Object.keys(platformStats).forEach(platform => {
    const stats = platformStats[platform];
    stats.averageEngagement = stats.totalEngagement / stats.count;
    stats.averageEngagementRate = stats.totalEngagementRate / stats.count;
    stats.averageClickThroughRate = stats.totalClickThroughRate / stats.count;
  });

  // Get top performing content
  const topPerformingContent = Object.values(contentPerformance)
    .sort((a: any, b: any) => b.engagement - a.engagement)
    .slice(0, 10);

  // Calculate trends (simplified - would need historical data for real trends)
  const trends = calculateTrends(feedbackData);

  return {
    totalEngagement: totalLikes + totalShares + totalComments,
    totalLikes,
    totalShares,
    totalComments,
    totalImpressions,
    totalReach,
    averageEngagementRate,
    averageClickThroughRate,
    platformBreakdown: platformStats,
    topPerformingContent,
    trends,
    summary: {
      bestPerformingPlatform: getBestPerformingPlatform(platformStats),
      worstPerformingPlatform: getWorstPerformingPlatform(platformStats),
      overallPerformance: categorizeOverallPerformance(averageEngagementRate, averageClickThroughRate)
    }
  };
}

/**
 * Calculate performance trends
 */
function calculateTrends(feedbackData: any[]): any {
  // Sort by timestamp
  const sortedData = feedbackData.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sortedData.length < 2) {
    return {
      engagement: 'stable',
      clickThrough: 'stable',
      direction: 'stable'
    };
  }

  // Split data into first and second half
  const midpoint = Math.floor(sortedData.length / 2);
  const firstHalf = sortedData.slice(0, midpoint);
  const secondHalf = sortedData.slice(midpoint);

  // Calculate averages for each half
  const firstHalfAvgEngagement = firstHalf.reduce((sum, f) => 
    sum + (f.metrics.engagementRate || 0), 0) / firstHalf.length;
  const secondHalfAvgEngagement = secondHalf.reduce((sum, f) => 
    sum + (f.metrics.engagementRate || 0), 0) / secondHalf.length;

  const firstHalfAvgCTR = firstHalf.reduce((sum, f) => 
    sum + (f.metrics.clickThroughRate || 0), 0) / firstHalf.length;
  const secondHalfAvgCTR = secondHalf.reduce((sum, f) => 
    sum + (f.metrics.clickThroughRate || 0), 0) / secondHalf.length;

  // Determine trends
  const engagementTrend = secondHalfAvgEngagement > firstHalfAvgEngagement * 1.1 ? 'up' :
                         secondHalfAvgEngagement < firstHalfAvgEngagement * 0.9 ? 'down' : 'stable';
  
  const ctrTrend = secondHalfAvgCTR > firstHalfAvgCTR * 1.1 ? 'up' :
                   secondHalfAvgCTR < firstHalfAvgCTR * 0.9 ? 'down' : 'stable';

  return {
    engagement: engagementTrend,
    clickThrough: ctrTrend,
    direction: engagementTrend === 'up' && ctrTrend === 'up' ? 'improving' :
               engagementTrend === 'down' && ctrTrend === 'down' ? 'declining' : 'mixed'
  };
}

/**
 * Get best performing platform
 */
function getBestPerformingPlatform(platformStats: Record<string, any>): string | null {
  let bestPlatform = null;
  let bestScore = -1;

  Object.entries(platformStats).forEach(([platform, stats]: [string, any]) => {
    const score = stats.averageEngagementRate + stats.averageClickThroughRate;
    if (score > bestScore) {
      bestScore = score;
      bestPlatform = platform;
    }
  });

  return bestPlatform;
}

/**
 * Get worst performing platform
 */
function getWorstPerformingPlatform(platformStats: Record<string, any>): string | null {
  let worstPlatform = null;
  let worstScore = Infinity;

  Object.entries(platformStats).forEach(([platform, stats]: [string, any]) => {
    const score = stats.averageEngagementRate + stats.averageClickThroughRate;
    if (score < worstScore) {
      worstScore = score;
      worstPlatform = platform;
    }
  });

  return worstPlatform;
}

/**
 * Categorize overall performance
 */
function categorizeOverallPerformance(avgEngagementRate: number, avgClickThroughRate: number): string {
  if (avgEngagementRate >= 0.1 || avgClickThroughRate >= 0.05) {
    return 'excellent';
  } else if (avgEngagementRate >= 0.05 || avgClickThroughRate >= 0.02) {
    return 'good';
  } else if (avgEngagementRate >= 0.02 || avgClickThroughRate >= 0.01) {
    return 'average';
  } else {
    return 'needs_improvement';
  }
}

/**
 * Get insights from OpenSearch
 */
async function getOpenSearchInsights(userId: string, filters: any): Promise<string[]> {
  try {
    // Import OpenSearch client
    const { Client } = require('@opensearch-project/opensearch');
    
    // Create OpenSearch client
    const client = new Client({
      node: process.env.OPENSEARCH_ENDPOINT || 'https://localhost:9200',
      auth: {
        username: process.env.OPENSEARCH_USERNAME || 'admin',
        password: process.env.OPENSEARCH_PASSWORD || 'admin'
      },
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Build search query
    const query: any = {
      bool: {
        must: [
          { term: { userId } }
        ]
      }
    };

    if (filters.platform) {
      query.bool.must.push({ term: { platform: filters.platform } });
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateRange: any = {};
      if (filters.dateFrom) dateRange.gte = filters.dateFrom;
      if (filters.dateTo) dateRange.lte = filters.dateTo;
      query.bool.must.push({ range: { timestamp: dateRange } });
    }

    // Search for patterns and insights
    const searchResponse = await client.search({
      index: 'contentflow-feedback-*',
      body: {
        query,
        aggs: {
          performance_by_platform: {
            terms: { field: 'platform' },
            aggs: {
              avg_engagement: { avg: { field: 'metrics.engagementRate' } },
              avg_ctr: { avg: { field: 'metrics.clickThroughRate' } }
            }
          },
          performance_by_hour: {
            terms: { field: 'hour' },
            aggs: {
              avg_engagement: { avg: { field: 'metrics.engagementRate' } }
            }
          },
          top_hashtags: {
            terms: { field: 'hashtags.keyword', size: 10 }
          }
        },
        size: 0
      }
    });

    // Generate insights from aggregations
    const insights: string[] = [];
    const aggs = searchResponse.body.aggregations;

    if (aggs.performance_by_platform?.buckets?.length > 0) {
      const bestPlatform = aggs.performance_by_platform.buckets
        .sort((a: any, b: any) => b.avg_engagement.value - a.avg_engagement.value)[0];
      insights.push(`Your content performs best on ${bestPlatform.key} with ${(bestPlatform.avg_engagement.value * 100).toFixed(1)}% engagement rate`);
    }

    if (aggs.performance_by_hour?.buckets?.length > 0) {
      const bestHour = aggs.performance_by_hour.buckets
        .sort((a: any, b: any) => b.avg_engagement.value - a.avg_engagement.value)[0];
      insights.push(`Your content gets the most engagement when posted at ${bestHour.key}:00`);
    }

    if (aggs.top_hashtags?.buckets?.length > 0) {
      const topHashtag = aggs.top_hashtags.buckets[0];
      insights.push(`Your most effective hashtag is #${topHashtag.key} (used ${topHashtag.doc_count} times)`);
    }

    return insights;

  } catch (error) {
    console.error('Error getting OpenSearch insights:', error);
    return ['Analytics insights temporarily unavailable'];
  }
}
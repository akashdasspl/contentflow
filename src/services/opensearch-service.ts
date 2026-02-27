import { EngagementFeedback } from '../types';

/**
 * Service for interacting with OpenSearch for analytics data storage and retrieval
 */
export class OpenSearchService {
  private client: any; // Using any to avoid OpenSearch client dependency issues
  private readonly indexPrefix = 'contentflow-feedback';

  constructor() {
    // Mock OpenSearch client for development - would use real client in production
    this.client = {
      index: async (params: any) => ({ body: { result: 'created' } }),
      search: async (params: any) => this.mockSearch(params),
      indices: {
        exists: async (params: any) => ({ body: false }),
        create: async (params: any) => ({ body: { acknowledged: true } })
      },
      deleteByQuery: async (params: any) => ({ body: { deleted: 0 } })
    };
  }

  /**
   * Mock search method for development
   */
  private mockSearch(params: any): any {
    // Return mock search results for development
    return {
      body: {
        hits: {
          total: { value: 0 },
          hits: []
        },
        aggregations: {
          platform_performance: {
            buckets: [
              {
                key: 'twitter',
                doc_count: 10,
                avg_engagement_rate: { value: 0.08 },
                avg_click_through_rate: { value: 0.03 },
                total_engagement: { value: 150 },
                avg_quality_score: { value: 75 }
              }
            ]
          },
          content_type_performance: {
            buckets: [
              {
                key: 'social-post',
                doc_count: 8,
                avg_engagement_rate: { value: 0.09 },
                avg_click_through_rate: { value: 0.035 }
              }
            ]
          },
          performance_over_time: {
            buckets: [
              {
                key_as_string: '2024-01-15',
                doc_count: 3,
                avg_engagement_rate: { value: 0.08 },
                avg_click_through_rate: { value: 0.03 }
              }
            ]
          },
          top_hashtags: {
            buckets: [
              { key: 'contentcreation', doc_count: 5 },
              { key: 'socialmedia', doc_count: 3 }
            ]
          },
          best_posting_hours: {
            buckets: [
              {
                key: 10,
                doc_count: 4,
                avg_engagement_rate: { value: 0.12 }
              },
              {
                key: 14,
                doc_count: 3,
                avg_engagement_rate: { value: 0.09 }
              }
            ]
          },
          performance_categories: {
            buckets: [
              { key: 'high', doc_count: 3 },
              { key: 'medium', doc_count: 5 },
              { key: 'low', doc_count: 2 }
            ]
          },
          trending_hashtags: {
            buckets: [
              {
                key: 'trending2024',
                doc_count: 15,
                avg_engagement: { value: 0.15 },
                trend_score: { value: 2.25 }
              }
            ]
          },
          high_performing_content: {
            buckets: [
              {
                key: 'content-123',
                max_engagement_rate: { value: 0.18 },
                max_click_through_rate: { value: 0.08 },
                platform: { buckets: [{ key: 'twitter' }] },
                content_type: { buckets: [{ key: 'social-post' }] }
              }
            ]
          },
          platform_trends: {
            buckets: [
              {
                key: 'twitter',
                performance_trend: {
                  buckets: [
                    {
                      key_as_string: '2024-01-15',
                      avg_engagement: { value: 0.08 }
                    }
                  ]
                }
              }
            ]
          }
        }
      }
    };
  }

  /**
   * Index feedback data for analytics
   */
  async indexFeedback(feedback: EngagementFeedback, contentMetadata?: any): Promise<void> {
    try {
      const indexName = this.getIndexName(new Date(feedback.timestamp));
      
      // Ensure index exists with proper mapping
      await this.ensureIndexExists(indexName);

      // Prepare document for indexing
      const document = this.prepareFeedbackDocument(feedback, contentMetadata);

      // Index the document
      await this.client.index({
        index: indexName,
        id: feedback.feedbackId,
        body: document,
        refresh: true
      });

      console.log(`Feedback ${feedback.feedbackId} indexed successfully in ${indexName}`);

    } catch (error) {
      console.error('Error indexing feedback:', error);
      throw new Error(`Failed to index feedback: ${error}`);
    }
  }

  /**
   * Search feedback data with filters and aggregations
   */
  async searchFeedback(searchParams: FeedbackSearchParams): Promise<FeedbackSearchResult> {
    try {
      const query = this.buildSearchQuery(searchParams);
      const aggs = this.buildAggregations(searchParams);

      const response = await this.client.search({
        index: `${this.indexPrefix}-*`,
        body: {
          query,
          aggs,
          size: searchParams.size || 100,
          from: searchParams.from || 0,
          sort: searchParams.sort || [{ timestamp: { order: 'desc' } }]
        }
      });

      return this.parseSearchResponse(response.body);

    } catch (error) {
      console.error('Error searching feedback:', error);
      throw new Error(`Failed to search feedback: ${error}`);
    }
  }

  /**
   * Get analytics insights for a user
   */
  async getUserInsights(userId: string, options: InsightOptions = {}): Promise<UserInsights> {
    try {
      const must: any[] = [{ term: { userId } }];

      // Add date range filter if provided
      if (options.dateFrom || options.dateTo) {
        const dateRange: any = {};
        if (options.dateFrom) dateRange.gte = options.dateFrom;
        if (options.dateTo) dateRange.lte = options.dateTo;
        must.push({ range: { timestamp: dateRange } });
      }

      // Add platform filter if provided
      if (options.platform) {
        must.push({ term: { platform: options.platform } });
      }

      const query = {
        bool: { must }
      };

      const response = await this.client.search({
        index: `${this.indexPrefix}-*`,
        body: {
          query,
          aggs: {
            platform_performance: {
              terms: { field: 'platform', size: 10 },
              aggs: {
                avg_engagement_rate: { avg: { field: 'metrics.engagementRate' } },
                avg_click_through_rate: { avg: { field: 'metrics.clickThroughRate' } },
                total_engagement: { sum: { field: 'totalEngagement' } },
                avg_quality_score: { avg: { field: 'qualityScore' } }
              }
            },
            content_type_performance: {
              terms: { field: 'contentType', size: 10 },
              aggs: {
                avg_engagement_rate: { avg: { field: 'metrics.engagementRate' } },
                avg_click_through_rate: { avg: { field: 'metrics.clickThroughRate' } }
              }
            },
            performance_over_time: {
              date_histogram: {
                field: 'timestamp',
                calendar_interval: options.timeInterval || 'day'
              },
              aggs: {
                avg_engagement_rate: { avg: { field: 'metrics.engagementRate' } },
                avg_click_through_rate: { avg: { field: 'metrics.clickThroughRate' } }
              }
            },
            top_hashtags: {
              terms: { field: 'hashtags.keyword', size: 20 }
            },
            best_posting_hours: {
              terms: { field: 'hour', size: 24 },
              aggs: {
                avg_engagement_rate: { avg: { field: 'metrics.engagementRate' } }
              }
            },
            performance_categories: {
              terms: { field: 'performanceCategory', size: 10 }
            }
          },
          size: 0
        }
      });

      return this.parseInsightsResponse(response.body, userId);

    } catch (error) {
      console.error('Error getting user insights:', error);
      throw new Error(`Failed to get user insights: ${error}`);
    }
  }

  /**
   * Get trending content patterns
   */
  async getTrendingPatterns(options: TrendingOptions = {}): Promise<TrendingPatterns> {
    try {
      const must: any[] = [
        { range: { timestamp: { gte: options.dateFrom || 'now-30d' } } }
      ];

      if (options.platform) {
        must.push({ term: { platform: options.platform } });
      }

      const query = {
        bool: { must }
      };

      const response = await this.client.search({
        index: `${this.indexPrefix}-*`,
        body: {
          query,
          aggs: {
            trending_hashtags: {
              terms: { field: 'hashtags.keyword', size: 50 },
              aggs: {
                avg_engagement: { avg: { field: 'metrics.engagementRate' } },
                trend_score: {
                  bucket_script: {
                    buckets_path: {
                      doc_count: '_count',
                      avg_engagement: 'avg_engagement'
                    },
                    script: 'params.doc_count * params.avg_engagement'
                  }
                }
              }
            },
            high_performing_content: {
              terms: { field: 'contentId', size: 20 },
              aggs: {
                max_engagement_rate: { max: { field: 'metrics.engagementRate' } },
                max_click_through_rate: { max: { field: 'metrics.clickThroughRate' } },
                platform: { terms: { field: 'platform', size: 1 } },
                content_type: { terms: { field: 'contentType', size: 1 } }
              }
            },
            platform_trends: {
              terms: { field: 'platform', size: 10 },
              aggs: {
                performance_trend: {
                  date_histogram: {
                    field: 'timestamp',
                    calendar_interval: 'day'
                  },
                  aggs: {
                    avg_engagement: { avg: { field: 'metrics.engagementRate' } }
                  }
                }
              }
            }
          },
          size: 0
        }
      });

      return this.parseTrendingResponse(response.body);

    } catch (error) {
      console.error('Error getting trending patterns:', error);
      throw new Error(`Failed to get trending patterns: ${error}`);
    }
  }

  /**
   * Delete user's feedback data (for GDPR compliance)
   */
  async deleteUserData(userId: string): Promise<void> {
    try {
      await this.client.deleteByQuery({
        index: `${this.indexPrefix}-*`,
        body: {
          query: {
            term: { userId }
          }
        },
        refresh: true
      });

      console.log(`Deleted all feedback data for user ${userId}`);

    } catch (error) {
      console.error('Error deleting user data:', error);
      throw new Error(`Failed to delete user data: ${error}`);
    }
  }

  /**
   * Get index name based on date (monthly indices)
   */
  private getIndexName(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${this.indexPrefix}-${year}-${month}`;
  }

  /**
   * Ensure index exists with proper mapping
   */
  private async ensureIndexExists(indexName: string): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index: indexName });
      
      if (!exists.body) {
        await this.client.indices.create({
          index: indexName,
          body: {
            mappings: {
              properties: {
                feedbackId: { type: 'keyword' },
                contentId: { type: 'keyword' },
                userId: { type: 'keyword' },
                platform: { type: 'keyword' },
                contentType: { type: 'keyword' },
                timestamp: { type: 'date' },
                createdAt: { type: 'date' },
                year: { type: 'integer' },
                month: { type: 'integer' },
                day: { type: 'integer' },
                hour: { type: 'integer' },
                metrics: {
                  properties: {
                    likes: { type: 'integer' },
                    shares: { type: 'integer' },
                    comments: { type: 'integer' },
                    clickThroughRate: { type: 'float' },
                    engagementRate: { type: 'float' },
                    impressions: { type: 'integer' },
                    reach: { type: 'integer' }
                  }
                },
                totalEngagement: { type: 'integer' },
                engagementScore: { type: 'float' },
                qualityScore: { type: 'float' },
                performanceCategory: { type: 'keyword' },
                wordCount: { type: 'integer' },
                hashtags: { 
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                seoKeywords: {
                  type: 'text',
                  fields: {
                    keyword: { type: 'keyword' }
                  }
                },
                brandVoice: { type: 'keyword' }
              }
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              'index.lifecycle.name': 'contentflow-feedback-policy',
              'index.lifecycle.rollover_alias': `${this.indexPrefix}-alias`
            }
          }
        });

        console.log(`Created index ${indexName}`);
      }
    } catch (error) {
      console.error(`Error ensuring index ${indexName} exists:`, error);
      // Don't throw - index might already exist
    }
  }

  /**
   * Prepare feedback document for indexing
   */
  private prepareFeedbackDocument(feedback: EngagementFeedback, contentMetadata?: any): any {
    const timestamp = new Date(feedback.timestamp);
    
    return {
      feedbackId: feedback.feedbackId,
      contentId: feedback.contentId,
      userId: feedback.userId,
      platform: feedback.platform,
      contentType: contentMetadata?.contentType || 'unknown',
      contentPlatform: contentMetadata?.platform || feedback.platform,
      metrics: feedback.metrics,
      timestamp: feedback.timestamp,
      createdAt: new Date().toISOString(),
      year: timestamp.getFullYear(),
      month: timestamp.getMonth() + 1,
      day: timestamp.getDate(),
      hour: timestamp.getHours(),
      // Content metadata
      wordCount: contentMetadata?.metadata?.wordCount || 0,
      hashtags: contentMetadata?.metadata?.hashtags || [],
      seoKeywords: contentMetadata?.metadata?.seoKeywords || [],
      brandVoice: contentMetadata?.metadata?.brandVoice || '',
      // Calculated metrics
      totalEngagement: (feedback.metrics.likes || 0) + 
                      (feedback.metrics.shares || 0) + 
                      (feedback.metrics.comments || 0),
      engagementScore: this.calculateEngagementScore(feedback.metrics),
      qualityScore: this.calculateQualityScore(feedback.metrics, contentMetadata),
      performanceCategory: this.categorizePerformance(feedback.metrics)
    };
  }

  /**
   * Build search query from parameters
   */
  private buildSearchQuery(params: FeedbackSearchParams): any {
    const must: any[] = [];

    if (params.userId) {
      must.push({ term: { userId: params.userId } });
    }

    if (params.contentId) {
      must.push({ term: { contentId: params.contentId } });
    }

    if (params.platform) {
      must.push({ term: { platform: params.platform } });
    }

    if (params.dateFrom || params.dateTo) {
      const dateRange: any = {};
      if (params.dateFrom) dateRange.gte = params.dateFrom;
      if (params.dateTo) dateRange.lte = params.dateTo;
      must.push({ range: { timestamp: dateRange } });
    }

    if (params.performanceCategory) {
      must.push({ term: { performanceCategory: params.performanceCategory } });
    }

    return must.length > 0 ? { bool: { must } } : { match_all: {} };
  }

  /**
   * Build aggregations for search
   */
  private buildAggregations(params: FeedbackSearchParams): any {
    const aggs: any = {};

    if (params.aggregations?.includes('platform')) {
      aggs.platform_stats = {
        terms: { field: 'platform', size: 10 },
        aggs: {
          avg_engagement_rate: { avg: { field: 'metrics.engagementRate' } },
          avg_click_through_rate: { avg: { field: 'metrics.clickThroughRate' } }
        }
      };
    }

    if (params.aggregations?.includes('performance')) {
      aggs.performance_stats = {
        terms: { field: 'performanceCategory', size: 10 }
      };
    }

    if (params.aggregations?.includes('time')) {
      aggs.time_stats = {
        date_histogram: {
          field: 'timestamp',
          calendar_interval: 'day'
        },
        aggs: {
          avg_engagement_rate: { avg: { field: 'metrics.engagementRate' } }
        }
      };
    }

    return aggs;
  }

  /**
   * Parse search response
   */
  private parseSearchResponse(response: any): FeedbackSearchResult {
    return {
      total: response.hits.total.value,
      hits: response.hits.hits.map((hit: any) => ({
        id: hit._id,
        source: hit._source,
        score: hit._score
      })),
      aggregations: response.aggregations || {}
    };
  }

  /**
   * Parse insights response
   */
  private parseInsightsResponse(response: any, userId: string): UserInsights {
    const aggs = response.aggregations;

    return {
      userId,
      platformPerformance: this.parsePlatformPerformance(aggs.platform_performance),
      contentTypePerformance: this.parseContentTypePerformance(aggs.content_type_performance),
      performanceOverTime: this.parsePerformanceOverTime(aggs.performance_over_time),
      topHashtags: this.parseTopHashtags(aggs.top_hashtags),
      bestPostingHours: this.parseBestPostingHours(aggs.best_posting_hours),
      performanceDistribution: this.parsePerformanceDistribution(aggs.performance_categories),
      insights: this.generateInsightsFromAggregations(aggs)
    };
  }

  /**
   * Parse trending response
   */
  private parseTrendingResponse(response: any): TrendingPatterns {
    const aggs = response.aggregations;

    return {
      trendingHashtags: this.parseTrendingHashtags(aggs.trending_hashtags),
      highPerformingContent: this.parseHighPerformingContent(aggs.high_performing_content),
      platformTrends: this.parsePlatformTrends(aggs.platform_trends)
    };
  }

  // Helper methods for parsing aggregations
  private parsePlatformPerformance(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      platform: bucket.key,
      count: bucket.doc_count,
      avgEngagementRate: bucket.avg_engagement_rate.value,
      avgClickThroughRate: bucket.avg_click_through_rate.value,
      totalEngagement: bucket.total_engagement.value,
      avgQualityScore: bucket.avg_quality_score.value
    })) || [];
  }

  private parseContentTypePerformance(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      contentType: bucket.key,
      count: bucket.doc_count,
      avgEngagementRate: bucket.avg_engagement_rate.value,
      avgClickThroughRate: bucket.avg_click_through_rate.value
    })) || [];
  }

  private parsePerformanceOverTime(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      date: bucket.key_as_string,
      count: bucket.doc_count,
      avgEngagementRate: bucket.avg_engagement_rate.value,
      avgClickThroughRate: bucket.avg_click_through_rate.value
    })) || [];
  }

  private parseTopHashtags(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      hashtag: bucket.key,
      count: bucket.doc_count
    })) || [];
  }

  private parseBestPostingHours(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      hour: bucket.key,
      count: bucket.doc_count,
      avgEngagementRate: bucket.avg_engagement_rate.value
    })).sort((a: any, b: any) => b.avgEngagementRate - a.avgEngagementRate) || [];
  }

  private parsePerformanceDistribution(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      category: bucket.key,
      count: bucket.doc_count
    })) || [];
  }

  private parseTrendingHashtags(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      hashtag: bucket.key,
      count: bucket.doc_count,
      avgEngagement: bucket.avg_engagement.value,
      trendScore: bucket.trend_score.value
    })).sort((a: any, b: any) => b.trendScore - a.trendScore) || [];
  }

  private parseHighPerformingContent(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      contentId: bucket.key,
      maxEngagementRate: bucket.max_engagement_rate.value,
      maxClickThroughRate: bucket.max_click_through_rate.value,
      platform: bucket.platform.buckets[0]?.key,
      contentType: bucket.content_type.buckets[0]?.key
    })) || [];
  }

  private parsePlatformTrends(agg: any): any[] {
    return agg?.buckets?.map((bucket: any) => ({
      platform: bucket.key,
      trend: bucket.performance_trend.buckets.map((timeBucket: any) => ({
        date: timeBucket.key_as_string,
        avgEngagement: timeBucket.avg_engagement.value
      }))
    })) || [];
  }

  private generateInsightsFromAggregations(aggs: any): string[] {
    const insights: string[] = [];

    // Platform insights
    if (aggs.platform_performance?.buckets?.length > 0) {
      const bestPlatform = aggs.platform_performance.buckets
        .sort((a: any, b: any) => b.avg_engagement_rate.value - a.avg_engagement_rate.value)[0];
      insights.push(`Your content performs best on ${bestPlatform.key} with ${(bestPlatform.avg_engagement_rate.value * 100).toFixed(1)}% engagement rate`);
    }

    // Posting time insights
    if (aggs.best_posting_hours?.buckets?.length > 0) {
      const bestHour = aggs.best_posting_hours.buckets
        .sort((a: any, b: any) => b.avg_engagement_rate.value - a.avg_engagement_rate.value)[0];
      insights.push(`Your content gets the most engagement when posted at ${bestHour.key}:00`);
    }

    // Hashtag insights
    if (aggs.top_hashtags?.buckets?.length > 0) {
      const topHashtag = aggs.top_hashtags.buckets[0];
      insights.push(`Your most used hashtag is #${topHashtag.key} (${topHashtag.doc_count} times)`);
    }

    return insights;
  }

  // Utility methods
  private calculateEngagementScore(metrics: any): number {
    const weights = { likes: 1, shares: 3, comments: 2, clickThroughRate: 5, engagementRate: 4 };
    let score = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([metric, weight]) => {
      const value = metrics[metric] || 0;
      score += value * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  private calculateQualityScore(metrics: any, _contentMetadata?: any): number {
    let score = 0;
    score += Math.min((metrics.engagementRate || 0) * 400, 40);
    score += Math.min((metrics.clickThroughRate || 0) * 600, 30);
    
    const likes = metrics.likes || 0;
    const comments = metrics.comments || 0;
    const interactionDepth = likes > 0 ? comments / likes : 0;
    score += Math.min(interactionDepth * 100, 20);

    return Math.round(score * 10) / 10;
  }

  private categorizePerformance(metrics: any): string {
    const engagementRate = metrics.engagementRate || 0;
    const clickThroughRate = metrics.clickThroughRate || 0;

    if (engagementRate >= 0.15 || clickThroughRate >= 0.08) return 'exceptional';
    if (engagementRate >= 0.1 || clickThroughRate >= 0.05) return 'high';
    if (engagementRate >= 0.05 || clickThroughRate >= 0.02) return 'medium';
    if (engagementRate >= 0.02 || clickThroughRate >= 0.01) return 'low';
    return 'poor';
  }
}

// Types
export interface FeedbackSearchParams {
  userId?: string;
  contentId?: string;
  platform?: string;
  dateFrom?: string;
  dateTo?: string;
  performanceCategory?: string;
  size?: number;
  from?: number;
  sort?: any[];
  aggregations?: string[];
}

export interface FeedbackSearchResult {
  total: number;
  hits: Array<{
    id: string;
    source: any;
    score: number;
  }>;
  aggregations: any;
}

export interface InsightOptions {
  dateFrom?: string;
  dateTo?: string;
  platform?: string;
  timeInterval?: string;
}

export interface UserInsights {
  userId: string;
  platformPerformance: any[];
  contentTypePerformance: any[];
  performanceOverTime: any[];
  topHashtags: any[];
  bestPostingHours: any[];
  performanceDistribution: any[];
  insights: string[];
}

export interface TrendingOptions {
  dateFrom?: string;
  platform?: string;
}

export interface TrendingPatterns {
  trendingHashtags: any[];
  highPerformingContent: any[];
  platformTrends: any[];
}

// Export singleton instance
export const openSearchService = new OpenSearchService();
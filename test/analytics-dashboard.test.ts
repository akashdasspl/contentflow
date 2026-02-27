import { analyticsDashboardService } from '../src/services/analytics-dashboard';
import { 
  userService, 
  generatedContentService, 
  engagementFeedbackService, 
  contentIdeaService 
} from '../src/services/database';

// Mock the database services
jest.mock('../src/services/database');

const mockUserService = userService as jest.Mocked<typeof userService>;
const mockGeneratedContentService = generatedContentService as jest.Mocked<typeof generatedContentService>;
const mockEngagementFeedbackService = engagementFeedbackService as jest.Mocked<typeof engagementFeedbackService>;
const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;

describe('AnalyticsDashboardService', () => {
  const mockUserId = 'user_123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getContentGenerationStats', () => {
    it('should return content generation statistics', async () => {
      // Mock data
      const mockContent = [
        {
          contentId: 'content_1',
          platform: 'blog',
          contentType: 'blog-post',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: { wordCount: 1000, qualityScore: 8.5 }
        },
        {
          contentId: 'content_2',
          platform: 'twitter',
          contentType: 'social-post',
          createdAt: '2024-01-02T00:00:00Z',
          metadata: { wordCount: 50, qualityScore: 7.2 }
        }
      ];

      const mockIdeas = [
        {
          ideaId: 'idea_1',
          createdAt: '2024-01-01T00:00:00Z',
          content: 'Test idea 1'
        },
        {
          ideaId: 'idea_2',
          createdAt: '2024-01-02T00:00:00Z',
          content: 'Test idea 2'
        }
      ];

      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent as any);
      mockContentIdeaService.getUserContentIdeas.mockResolvedValue(mockIdeas as any);

      const result = await analyticsDashboardService.getContentGenerationStats(mockUserId);

      expect(result.totalContent).toBe(2);
      expect(result.totalIdeas).toBe(2);
      expect(result.totalWords).toBe(1050);
      expect(result.averageWordsPerContent).toBe(525);
      expect(result.averageQualityScore).toBe(7.9); // (8.5 + 7.2) / 2 rounded
      expect(result.platformBreakdown).toEqual({
        blog: 1,
        twitter: 1
      });
      expect(result.contentTypeBreakdown).toEqual({
        'blog-post': 1,
        'social-post': 1
      });
    });

    it('should handle empty content data', async () => {
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue([]);
      mockContentIdeaService.getUserContentIdeas.mockResolvedValue([]);

      const result = await analyticsDashboardService.getContentGenerationStats(mockUserId);

      expect(result.totalContent).toBe(0);
      expect(result.totalIdeas).toBe(0);
      expect(result.totalWords).toBe(0);
      expect(result.averageWordsPerContent).toBe(0);
      expect(result.averageQualityScore).toBe(0);
    });

    it('should filter by date range when provided', async () => {
      const mockContent = [
        {
          contentId: 'content_1',
          platform: 'blog',
          contentType: 'blog-post',
          createdAt: '2024-01-01T00:00:00Z',
          metadata: { wordCount: 1000, qualityScore: 8.5 }
        },
        {
          contentId: 'content_2',
          platform: 'twitter',
          contentType: 'social-post',
          createdAt: '2024-02-01T00:00:00Z', // Outside date range
          metadata: { wordCount: 50, qualityScore: 7.2 }
        }
      ];

      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent as any);
      mockContentIdeaService.getUserContentIdeas.mockResolvedValue([]);

      const dateRange = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z'
      };

      const result = await analyticsDashboardService.getContentGenerationStats(mockUserId, dateRange);

      expect(result.totalContent).toBe(1); // Only content within date range
      expect(result.totalWords).toBe(1000);
    });
  });

  describe('getEngagementStats', () => {
    it('should return engagement statistics', async () => {
      const mockFeedback = [
        {
          feedbackId: 'feedback_1',
          timestamp: '2024-01-01T00:00:00Z',
          metrics: {
            likes: 10,
            shares: 5,
            comments: 3,
            engagementRate: 0.05,
            clickThroughRate: 0.02,
            impressions: 1000,
            reach: 800
          }
        },
        {
          feedbackId: 'feedback_2',
          timestamp: '2024-01-02T00:00:00Z',
          metrics: {
            likes: 20,
            shares: 8,
            comments: 6,
            engagementRate: 0.08,
            clickThroughRate: 0.03,
            impressions: 1200,
            reach: 900
          }
        }
      ];

      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedback as any);

      const result = await analyticsDashboardService.getEngagementStats(mockUserId);

      expect(result.totalEngagement).toBe(52); // 10+5+3+20+8+6
      expect(result.totalLikes).toBe(30);
      expect(result.totalShares).toBe(13);
      expect(result.totalComments).toBe(9);
      expect(result.totalImpressions).toBe(2200);
      expect(result.totalReach).toBe(1700);
      expect(result.averageEngagementRate).toBe(0.065); // (0.05 + 0.08) / 2
      expect(result.averageClickThroughRate).toBe(0.025); // (0.02 + 0.03) / 2
    });

    it('should return empty stats when no feedback data', async () => {
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);

      const result = await analyticsDashboardService.getEngagementStats(mockUserId);

      expect(result.totalEngagement).toBe(0);
      expect(result.totalLikes).toBe(0);
      expect(result.totalShares).toBe(0);
      expect(result.totalComments).toBe(0);
      expect(result.averageEngagementRate).toBe(0);
      expect(result.averageClickThroughRate).toBe(0);
    });
  });

  describe('getPlatformStats', () => {
    it('should return platform-specific statistics', async () => {
      const mockContent = [
        {
          contentId: 'content_1',
          platform: 'blog',
          createdAt: '2024-01-01T00:00:00Z'
        },
        {
          contentId: 'content_2',
          platform: 'twitter',
          createdAt: '2024-01-02T00:00:00Z'
        },
        {
          contentId: 'content_3',
          platform: 'twitter',
          createdAt: '2024-01-03T00:00:00Z'
        }
      ];

      const mockFeedback = [
        {
          contentId: 'content_1',
          platform: 'blog',
          timestamp: '2024-01-01T00:00:00Z',
          metrics: {
            likes: 10,
            shares: 5,
            comments: 3,
            engagementRate: 0.05,
            clickThroughRate: 0.02
          }
        },
        {
          contentId: 'content_2',
          platform: 'twitter',
          timestamp: '2024-01-02T00:00:00Z',
          metrics: {
            likes: 20,
            shares: 8,
            comments: 6,
            engagementRate: 0.08,
            clickThroughRate: 0.03
          }
        }
      ];

      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent as any);
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedback as any);

      const result = await analyticsDashboardService.getPlatformStats(mockUserId);

      expect(result.platformData.blog.contentCount).toBe(1);
      expect(result.platformData.twitter.contentCount).toBe(2);
      expect(result.platformData.blog.totalEngagement).toBe(18); // 10+5+3
      expect(result.platformData.twitter.totalEngagement).toBe(34); // 20+8+6
      expect(result.bestPerformingPlatform).toBe('twitter'); // Higher engagement rate
    });
  });

  describe('getAnalyticsSummary', () => {
    it('should return analytics summary for a period', async () => {
      // Mock the getDashboardData method
      const mockDashboardData = {
        userId: mockUserId,
        dateRange: { startDate: '2024-01-01T00:00:00Z', endDate: '2024-01-31T23:59:59Z' },
        contentStats: {
          totalContent: 10,
          averageQualityScore: 8.0
        },
        engagementStats: {
          totalEngagement: 500,
          averageEngagementRate: 0.06
        },
        platformStats: {
          bestPerformingPlatform: 'twitter'
        },
        performanceMetrics: {
          contentVelocity: 2.5
        },
        insights: ['Great engagement!', 'Keep up the good work!', 'Twitter is your best platform']
      };

      jest.spyOn(analyticsDashboardService, 'getDashboardData').mockResolvedValue(mockDashboardData as any);

      const result = await analyticsDashboardService.getAnalyticsSummary(mockUserId, 'month');

      expect(result.userId).toBe(mockUserId);
      expect(result.period).toBe('month');
      expect(result.summary.totalContent).toBe(10);
      expect(result.summary.totalEngagement).toBe(500);
      expect(result.summary.averageEngagementRate).toBe(0.06);
      expect(result.summary.bestPlatform).toBe('twitter');
      expect(result.highlights.length).toBeLessThanOrEqual(5); // Limited to 5 highlights
    });
  });

  describe('getRecentActivity', () => {
    it('should return recent activity items', async () => {
      const mockContent = [
        {
          contentId: 'content_1',
          platform: 'blog',
          contentType: 'blog-post',
          createdAt: '2024-01-03T00:00:00Z',
          metadata: { wordCount: 1000 }
        }
      ];

      const mockFeedback = [
        {
          feedbackId: 'feedback_1',
          contentId: 'content_1',
          platform: 'blog',
          timestamp: '2024-01-02T00:00:00Z',
          metrics: {
            likes: 10,
            shares: 5,
            comments: 3,
            engagementRate: 0.05
          }
        }
      ];

      const mockIdeas = [
        {
          ideaId: 'idea_1',
          content: 'Test content idea',
          createdAt: '2024-01-01T00:00:00Z',
          extractedThemes: ['technology'],
          intent: 'informational'
        }
      ];

      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent as any);
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedback as any);
      mockContentIdeaService.getUserContentIdeas.mockResolvedValue(mockIdeas as any);

      const result = await analyticsDashboardService.getRecentActivity(mockUserId, 5);

      expect(result).toHaveLength(3); // 1 content + 1 feedback + 1 idea
      expect(result[0].type).toBe('content_generated'); // Most recent first
      expect(result[0].title).toContain('Generated blog-post for blog');
      expect(result[1].type).toBe('feedback_received');
      expect(result[2].type).toBe('idea_submitted');
    });

    it('should limit results to specified limit', async () => {
      const mockContent = Array.from({ length: 10 }, (_, i) => ({
        contentId: `content_${i}`,
        platform: 'blog',
        contentType: 'blog-post',
        createdAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        metadata: { wordCount: 1000 }
      }));

      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent as any);
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);
      mockContentIdeaService.getUserContentIdeas.mockResolvedValue([]);

      const result = await analyticsDashboardService.getRecentActivity(mockUserId, 3);

      expect(result).toHaveLength(3);
    });
  });

  describe('generateInsights', () => {
    it('should generate insights based on analytics data', async () => {
      const mockContentStats = {
        totalContent: 20,
        averageQualityScore: 8.5,
        trend: 'increasing' as const,
        platformBreakdown: { twitter: 10, blog: 5, instagram: 5 },
        contentTypeBreakdown: { 'social-post': 15, 'blog-post': 5 }
      };

      const mockEngagementStats = {
        totalEngagement: 1000,
        averageEngagementRate: 0.12,
        engagementTrend: 'increasing' as const
      };

      const mockPlatformStats = {
        bestPerformingPlatform: 'twitter' as const,
        platformRankings: [
          { platform: 'twitter' as const, score: 0.15 },
          { platform: 'blog' as const, score: 0.05 }
        ]
      };

      jest.spyOn(analyticsDashboardService, 'getContentGenerationStats').mockResolvedValue(mockContentStats as any);
      jest.spyOn(analyticsDashboardService, 'getEngagementStats').mockResolvedValue(mockEngagementStats as any);
      jest.spyOn(analyticsDashboardService, 'getPlatformStats').mockResolvedValue(mockPlatformStats as any);

      const result = await analyticsDashboardService.generateInsights(mockUserId);

      expect(result).toContain('Your content production is trending upward - great consistency!');
      expect(result).toContain('Your content quality is excellent - maintain these high standards');
      expect(result).toContain('Your content achieves excellent engagement rates');
      expect(result).toContain('Your engagement is growing - keep up the great work!');
      expect(result).toContain('twitter is your best performing platform');
      expect(result.length).toBeLessThanOrEqual(8); // Limited to 8 insights
    });

    it('should provide improvement suggestions for poor performance', async () => {
      const mockContentStats = {
        totalContent: 5,
        averageQualityScore: 4.0,
        trend: 'decreasing' as const,
        platformBreakdown: { twitter: 3, blog: 2 },
        contentTypeBreakdown: { 'social-post': 5 }
      };

      const mockEngagementStats = {
        totalEngagement: 50,
        averageEngagementRate: 0.01,
        engagementTrend: 'stable' as const
      };

      const mockPlatformStats = {
        bestPerformingPlatform: 'twitter' as const,
        platformRankings: [
          { platform: 'twitter' as const, score: 0.02 },
          { platform: 'blog' as const, score: 0.01 }
        ]
      };

      jest.spyOn(analyticsDashboardService, 'getContentGenerationStats').mockResolvedValue(mockContentStats as any);
      jest.spyOn(analyticsDashboardService, 'getEngagementStats').mockResolvedValue(mockEngagementStats as any);
      jest.spyOn(analyticsDashboardService, 'getPlatformStats').mockResolvedValue(mockPlatformStats as any);

      const result = await analyticsDashboardService.generateInsights(mockUserId);

      expect(result).toContain('Consider increasing your content production frequency for better results');
      expect(result).toContain('Focus on improving content quality for better engagement');
      expect(result).toContain('Consider optimizing your content strategy to improve engagement');
    });
  });
});
import { handler as getDashboardHandler } from '../src/lambda/analytics/get-dashboard';
import { handler as getSummaryHandler } from '../src/lambda/analytics/get-summary';
import { handler as getContentStatsHandler } from '../src/lambda/analytics/get-content-stats';
import { handler as getPerformanceMetricsHandler } from '../src/lambda/analytics/get-performance-metrics';
import { handler as getPlatformStatsHandler } from '../src/lambda/analytics/get-platform-stats';
import { handler as getActivityFeedHandler } from '../src/lambda/analytics/get-activity-feed';
import { analyticsDashboardService } from '../src/services/analytics-dashboard';
import { validateToken } from '../src/utils';
import { APIGatewayEvent } from '../src/types';

// Mock dependencies
jest.mock('../src/services/analytics-dashboard');
jest.mock('../src/utils');

const mockAnalyticsDashboardService = analyticsDashboardService as jest.Mocked<typeof analyticsDashboardService>;
const mockValidateToken = validateToken as jest.MockedFunction<typeof validateToken>;

describe('Analytics Lambda Functions', () => {
  const mockUserId = 'user_123';
  const mockAuthHeader = 'Bearer valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateToken.mockResolvedValue({ isValid: true, userId: mockUserId });
  });

  const createMockEvent = (
    queryStringParameters?: Record<string, string> | null,
    body?: string | null,
    headers?: Record<string, string>
  ): APIGatewayEvent => ({
    httpMethod: 'GET',
    path: '/analytics/dashboard',
    pathParameters: null,
    queryStringParameters: queryStringParameters || null,
    headers: { Authorization: mockAuthHeader, ...headers },
    body: body || null,
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent'
      }
    }
  });

  describe('getDashboardHandler', () => {
    it('should return dashboard data successfully', async () => {
      const mockDashboardData = {
        userId: mockUserId,
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        contentStats: { totalContent: 10 },
        engagementStats: { totalEngagement: 100 },
        platformStats: {},
        performanceMetrics: {},
        recentActivity: [],
        insights: [],
        generatedAt: new Date().toISOString()
      };

      mockAnalyticsDashboardService.getDashboardData.mockResolvedValue(mockDashboardData as any);

      const event = createMockEvent();
      const response = await getDashboardHandler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
      expect(JSON.parse(response.body).data).toEqual(mockDashboardData);
    });

    it('should handle date range parameters', async () => {
      const mockDashboardData = {
        userId: mockUserId,
        dateRange: { startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-01-31T23:59:59.999Z' },
        contentStats: {},
        engagementStats: {},
        platformStats: {},
        performanceMetrics: {},
        recentActivity: [],
        insights: [],
        generatedAt: new Date().toISOString()
      };

      mockAnalyticsDashboardService.getDashboardData.mockResolvedValue(mockDashboardData as any);

      const event = createMockEvent({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-31T23:59:59.999Z'
      });
      const response = await getDashboardHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockAnalyticsDashboardService.getDashboardData).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String)
        })
      );
    });

    it('should return 401 for unauthorized requests', async () => {
      mockValidateToken.mockResolvedValue({ isValid: false, userId: undefined });

      const event = createMockEvent();
      const response = await getDashboardHandler(event);

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body).error).toBe('Unauthorized');
    });

    it('should return 400 for invalid date format', async () => {
      const event = createMockEvent({
        startDate: 'invalid-date',
        endDate: '2024-01-31'
      });
      const response = await getDashboardHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid date format');
    });
  });

  describe('getContentStatsHandler', () => {
    it('should return content statistics successfully', async () => {
      const mockContentStats = {
        totalContent: 25,
        totalIdeas: 30,
        totalWords: 50000,
        averageWordsPerContent: 2000,
        averageQualityScore: 8.5,
        platformBreakdown: { 
          blog: 10, 
          twitter: 15,
          facebook: 0,
          instagram: 0,
          linkedin: 0,
          youtube: 0,
          tiktok: 0
        },
        contentTypeBreakdown: { 
          'blog-post': 10, 
          'social-post': 15,
          'caption': 0,
          'script': 0,
          'email': 0,
          'ad-copy': 0
        },
        contentByDate: {},
        trend: 'increasing' as const,
        topPerformingContent: []
      };

      mockAnalyticsDashboardService.getContentGenerationStats.mockResolvedValue(mockContentStats);

      const event = createMockEvent();
      const response = await getContentStatsHandler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
      expect(JSON.parse(response.body).data.contentStats).toEqual(mockContentStats);
    });
  });

  describe('getPerformanceMetricsHandler', () => {
    it('should return performance metrics successfully', async () => {
      const mockPerformanceMetrics = {
        contentVelocity: 2.5,
        engagementGrowth: 15,
        qualityTrend: 'increasing' as const,
        roi: 5.2,
        overallPerformance: 'good' as const,
        kpis: {
          contentProductivity: 25,
          engagementEfficiency: 0.08,
          qualityConsistency: 8.5,
          platformDiversification: 5
        }
      };

      mockAnalyticsDashboardService.getPerformanceMetrics.mockResolvedValue(mockPerformanceMetrics);

      const event = createMockEvent();
      const response = await getPerformanceMetricsHandler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
      expect(JSON.parse(response.body).data.performanceMetrics).toEqual(mockPerformanceMetrics);
    });
  });

  describe('getPlatformStatsHandler', () => {
    it('should return platform statistics successfully', async () => {
      const mockPlatformStats = {
        platformData: {
          blog: {
            contentCount: 10,
            totalEngagement: 500,
            averageEngagementRate: 0.05,
            averageClickThroughRate: 0.02,
            totalImpressions: 10000,
            totalReach: 8000,
            bestPerformingContent: null
          }
        },
        bestPerformingPlatform: 'blog' as const,
        worstPerformingPlatform: null,
        platformRankings: []
      };

      mockAnalyticsDashboardService.getPlatformStats.mockResolvedValue(mockPlatformStats as any);

      const event = createMockEvent();
      const response = await getPlatformStatsHandler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
    });

    it('should filter by specific platform when requested', async () => {
      const mockPlatformStats = {
        platformData: {
          blog: {
            contentCount: 10,
            totalEngagement: 500,
            averageEngagementRate: 0.05,
            averageClickThroughRate: 0.02,
            totalImpressions: 10000,
            totalReach: 8000,
            bestPerformingContent: null
          },
          twitter: {
            contentCount: 15,
            totalEngagement: 300,
            averageEngagementRate: 0.03,
            averageClickThroughRate: 0.01,
            totalImpressions: 5000,
            totalReach: 4000,
            bestPerformingContent: null
          }
        },
        bestPerformingPlatform: 'blog' as const,
        worstPerformingPlatform: 'twitter' as const,
        platformRankings: []
      };

      mockAnalyticsDashboardService.getPlatformStats.mockResolvedValue(mockPlatformStats as any);

      const event = createMockEvent({ platform: 'blog' });
      const response = await getPlatformStatsHandler(event);

      expect(response.statusCode).toBe(200);
      const responseData = JSON.parse(response.body).data;
      expect(responseData.platform).toBe('blog');
    });

    it('should return 400 for invalid platform parameter', async () => {
      const event = createMockEvent({ platform: 'invalid-platform' });
      const response = await getPlatformStatsHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid platform parameter');
    });
  });

  describe('getActivityFeedHandler', () => {
    it('should return recent activity feed successfully', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          type: 'content_generated' as const,
          timestamp: new Date().toISOString(),
          title: 'Generated blog post',
          description: 'Created 1500 words of content',
          metadata: {}
        }
      ];

      mockAnalyticsDashboardService.getRecentActivity.mockResolvedValue(mockActivities);

      const event = createMockEvent();
      const response = await getActivityFeedHandler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
      expect(JSON.parse(response.body).data.activities).toEqual(mockActivities);
    });

    it('should respect limit parameter', async () => {
      mockAnalyticsDashboardService.getRecentActivity.mockResolvedValue([]);

      const event = createMockEvent({ limit: '5' });
      const response = await getActivityFeedHandler(event);

      expect(response.statusCode).toBe(200);
      expect(mockAnalyticsDashboardService.getRecentActivity).toHaveBeenCalledWith(mockUserId, 5);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const event = createMockEvent({ limit: '200' });
      const response = await getActivityFeedHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid limit parameter');
    });
  });

  describe('getSummaryHandler', () => {
    it('should return analytics summary successfully', async () => {
      const mockSummary = {
        userId: mockUserId,
        period: 'month' as const,
        dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' },
        summary: {
          totalContent: 25,
          totalEngagement: 1000,
          averageEngagementRate: 0.05,
          bestPlatform: 'blog' as const,
          contentVelocity: 2.5,
          qualityScore: 8.5
        },
        highlights: ['Great engagement!'],
        generatedAt: new Date().toISOString()
      };

      mockAnalyticsDashboardService.getAnalyticsSummary.mockResolvedValue(mockSummary);

      const event = createMockEvent({ period: 'month' });
      const response = await getSummaryHandler(event);

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).success).toBe(true);
      expect(JSON.parse(response.body).data).toEqual(mockSummary);
    });

    it('should return 400 for invalid period parameter', async () => {
      const event = createMockEvent({ period: 'invalid-period' });
      const response = await getSummaryHandler(event);

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body).error).toContain('Invalid period parameter');
    });
  });
});

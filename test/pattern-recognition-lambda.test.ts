import { handler } from '../src/lambda/feedback/get-patterns';
import { patternRecognitionService } from '../src/services/pattern-recognition';
import { APIGatewayEvent } from '../src/types';

// Mock the pattern recognition service
jest.mock('../src/services/pattern-recognition');

const mockPatternRecognitionService = patternRecognitionService as jest.Mocked<typeof patternRecognitionService>;

describe('Get Patterns Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockEvent = (overrides: Partial<APIGatewayEvent> = {}): APIGatewayEvent => ({
    httpMethod: 'GET',
    path: '/patterns/user-123',
    pathParameters: { userId: 'user-123' },
    queryStringParameters: {},
    headers: {},
    body: null,
    requestContext: {} as any,
    resource: '',
    ...overrides
  });

  const createMockPatternResult = () => ({
    userId: 'user-123',
    analysisDate: '2024-01-15T10:00:00.000Z',
    timeRange: { from: null, to: null },
    platformPatterns: [
      {
        platform: 'twitter',
        contentCount: 10,
        avgEngagementRate: 0.08,
        avgClickThroughRate: 0.03,
        performanceScore: 0.06,
        patternType: 'high_performer' as const,
        insights: ['Twitter is your top performing platform']
      }
    ],
    contentTypePatterns: [
      {
        contentType: 'social-post',
        contentCount: 8,
        avgEngagementRate: 0.09,
        avgClickThroughRate: 0.035,
        effectivenessScore: 0.074,
        recommendation: 'Highly effective - create more of this content type'
      }
    ],
    temporalPatterns: {
      bestHours: [
        {
          hour: 10,
          avgEngagementRate: 0.12,
          contentCount: 4,
          effectiveness: 'high'
        }
      ],
      dayOfWeekPatterns: [],
      postingFrequency: {
        avgPostsPerDay: 1.5,
        consistency: 'medium',
        recommendation: 'Current posting frequency is optimal'
      },
      insights: ['Your content performs best when posted at 10:00']
    },
    hashtagPatterns: {
      topPerformingHashtags: [
        { hashtag: 'contentcreation', usageCount: 15, effectiveness: 'high' }
      ],
      underutilizedHashtags: [],
      trendingOpportunities: [
        { hashtag: 'trending2024', trendScore: 2.25, avgEngagement: 0.15, opportunity: 'high' }
      ],
      insights: ['#contentcreation is your most effective hashtag']
    },
    engagementPatterns: {
      avgEngagementRate: 0.08,
      consistency: 'medium',
      highPerformanceRate: 0.3,
      engagementTypes: [
        { platform: 'twitter', engagementType: 'interaction_focused', strength: 'medium' }
      ],
      patterns: ['platform_balanced', 'mixed_performance']
    },
    successFactors: [
      {
        type: 'platform' as const,
        factor: 'twitter optimization',
        impact: 'high' as const,
        confidence: 0.9,
        description: 'Content performs 160% better on twitter',
        recommendation: 'Focus more content creation on twitter'
      }
    ],
    recommendations: [
      'Focus more content on twitter - your best performing platform',
      'Post more content at 10:00 for optimal engagement'
    ]
  });

  describe('Performance Patterns Analysis', () => {
    it('should return performance patterns successfully', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: { type: 'performance' }
      });
      const mockResult = createMockPatternResult();

      mockPatternRecognitionService.identifyPerformancePatterns.mockResolvedValue(mockResult);

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.analysisType).toBe('performance');
      expect(body.userId).toBe('user-123');
      expect(body.platformPatterns).toBeDefined();
      expect(body.contentTypePatterns).toBeDefined();
      expect(body.temporalPatterns).toBeDefined();
      expect(body.hashtagPatterns).toBeDefined();
      expect(body.engagementPatterns).toBeDefined();
      expect(body.successFactors).toBeDefined();
      expect(body.recommendations).toBeDefined();

      expect(mockPatternRecognitionService.identifyPerformancePatterns).toHaveBeenCalledWith('user-123', {
        platform: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        timeInterval: 'day'
      });
    });

    it('should handle query parameters correctly', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: {
          type: 'performance',
          platform: 'twitter',
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
          timeInterval: 'week'
        }
      });
      const mockResult = createMockPatternResult();

      mockPatternRecognitionService.identifyPerformancePatterns.mockResolvedValue(mockResult);

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.filters).toEqual({
        platform: 'twitter',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        timeInterval: 'week'
      });

      expect(mockPatternRecognitionService.identifyPerformancePatterns).toHaveBeenCalledWith('user-123', {
        platform: 'twitter',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        timeInterval: 'week'
      });
    });
  });

  describe('Content Analysis', () => {
    it('should return content analysis successfully', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: { type: 'content' }
      });
      const mockResult = {
        userId: 'user-123',
        analysisDate: '2024-01-15T10:00:00.000Z',
        criteria: {
          minEngagementRate: 0.1,
          minClickThroughRate: 0.05,
          platform: null,
          contentType: null
        },
        highPerformingContent: [],
        characteristics: {
          avgWordCount: 150,
          commonHashtags: [{ hashtag: 'contentcreation', count: 5 }],
          avgHashtagCount: 3,
          commonKeywords: [{ keyword: 'content', count: 8 }],
          avgEngagementRate: 0.12,
          avgClickThroughRate: 0.06,
          platformDistribution: { twitter: 0.6, facebook: 0.4 },
          contentTypeDistribution: { 'social-post': 0.8, 'blog-post': 0.2 },
          postingTimeDistribution: { '10:00': 0.4, '14:00': 0.3, '18:00': 0.3 }
        },
        benchmarkComparison: {
          wordCountComparison: { difference: 25, significance: 'medium' },
          hashtagCountComparison: { difference: 1, significance: 'low' },
          engagementRateComparison: { difference: 0.04, significance: 'high' },
          clickThroughRateComparison: { difference: 0.02, significance: 'medium' }
        },
        insights: [
          'High-performing content tends to be longer than your average',
          '#contentcreation appears in 5 high-performing posts'
        ],
        recommendations: [
          'Aim for approximately 150 words for optimal performance',
          'Use these high-performing hashtags: #contentcreation'
        ]
      };

      mockPatternRecognitionService.analyzeSuccessfulContent.mockResolvedValue(mockResult);

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.analysisType).toBe('content');
      expect(body.characteristics).toBeDefined();
      expect(body.benchmarkComparison).toBeDefined();
      expect(body.insights).toBeDefined();
      expect(body.recommendations).toBeDefined();
    });

    it('should handle content analysis parameters', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: {
          type: 'content',
          minEngagementRate: '0.15',
          minClickThroughRate: '0.08',
          contentType: 'social-post'
        }
      });

      mockPatternRecognitionService.analyzeSuccessfulContent.mockResolvedValue({} as any);

      // Act
      await handler(event);

      // Assert
      expect(mockPatternRecognitionService.analyzeSuccessfulContent).toHaveBeenCalledWith('user-123', {
        platform: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        contentType: 'social-post',
        minEngagementRate: 0.15,
        minClickThroughRate: 0.08
      });
    });
  });

  describe('Trend Analysis', () => {
    it('should return trend analysis successfully', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: { type: 'trends' }
      });
      const mockResult = {
        userId: 'user-123',
        analysisDate: '2024-01-15T10:00:00.000Z',
        timeRange: {
          from: null,
          to: null,
          interval: 'day'
        },
        overallTrend: 'improving',
        platformTrends: { twitter: 'improving', facebook: 'stable' },
        seasonalPatterns: {
          weeklyPattern: 'moderate_weekly_variation',
          monthlyPattern: 'insufficient_data',
          insights: ['Some days of the week perform better than others']
        },
        momentum: {
          current: 'positive',
          strength: 'moderate',
          direction: 'positive',
          changePercent: 15.5,
          recentAvg: 0.092,
          earlierAvg: 0.08
        },
        forecasts: {
          shortTerm: 0.095,
          confidence: 'medium',
          trend: 'improving',
          recommendations: ['Continue current strategy - performance is trending upward']
        },
        trendingTopics: [
          { hashtag: 'trending2024', count: 15, avgEngagement: 0.15, trendScore: 2.25 }
        ],
        insights: [
          'Your content performance is moderate improving over time',
          'Recent momentum is moderate positive - 15.5% improvement'
        ],
        recommendations: [
          'Continue current strategy and consider scaling successful content types',
          'Leverage trending topics: #trending2024'
        ]
      };

      mockPatternRecognitionService.generateTrendAnalysis.mockResolvedValue(mockResult);

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.analysisType).toBe('trends');
      expect(body.overallTrend).toBe('improving');
      expect(body.momentum).toBeDefined();
      expect(body.forecasts).toBeDefined();
      expect(body.trendingTopics).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for missing user ID', async () => {
      // Arrange
      const event = createMockEvent({
        pathParameters: null
      });

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('User ID is required');
    });

    it('should return 400 for invalid analysis type', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: { type: 'invalid' }
      });

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid analysis type');
    });

    it('should return 400 for invalid date range', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: {
          dateFrom: '2024-01-31',
          dateTo: '2024-01-01' // End before start
        }
      });

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid date range');
    });

    it('should return 500 for service errors', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: { type: 'performance' }
      });

      mockPatternRecognitionService.identifyPerformancePatterns.mockRejectedValue(
        new Error('Service error')
      );

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toBe('Failed to retrieve patterns');
    });
  });

  describe('Default Parameters', () => {
    it('should use default analysis type', async () => {
      // Arrange
      const event = createMockEvent(); // No type specified
      const mockResult = createMockPatternResult();

      mockPatternRecognitionService.identifyPerformancePatterns.mockResolvedValue(mockResult);

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.analysisType).toBe('performance'); // Default type
    });

    it('should use default time interval', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: { type: 'performance' }
      });
      const mockResult = createMockPatternResult();

      mockPatternRecognitionService.identifyPerformancePatterns.mockResolvedValue(mockResult);

      // Act
      await handler(event);

      // Assert
      expect(mockPatternRecognitionService.identifyPerformancePatterns).toHaveBeenCalledWith('user-123', {
        platform: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        timeInterval: 'day' // Default interval
      });
    });
  });

  describe('Response Format', () => {
    it('should include all required response fields', async () => {
      // Arrange
      const event = createMockEvent({
        queryStringParameters: {
          type: 'performance',
          platform: 'twitter',
          dateFrom: '2024-01-01'
        }
      });
      const mockResult = createMockPatternResult();

      mockPatternRecognitionService.identifyPerformancePatterns.mockResolvedValue(mockResult);

      // Act
      const response = await handler(event);

      // Assert
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('analysisType');
      expect(body).toHaveProperty('filters');
      expect(body).toHaveProperty('generatedAt');
      expect(body).toHaveProperty('userId');
      expect(body).toHaveProperty('analysisDate');
      
      expect(body.filters).toEqual({
        platform: 'twitter',
        dateFrom: '2024-01-01',
        dateTo: null,
        timeInterval: 'day'
      });
      
      expect(body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
import { PatternRecognitionService } from '../src/services/pattern-recognition';
import { openSearchService } from '../src/services/opensearch-service';

// Mock the OpenSearch service
jest.mock('../src/services/opensearch-service');

const mockOpenSearchService = openSearchService as jest.Mocked<typeof openSearchService>;

describe('PatternRecognitionService', () => {
  let service: PatternRecognitionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PatternRecognitionService();
  });

  const createMockInsights = () => ({
    userId: 'user-123',
    platformPerformance: [
      {
        platform: 'twitter',
        count: 10,
        avgEngagementRate: 0.08,
        avgClickThroughRate: 0.03,
        totalEngagement: 150,
        avgQualityScore: 75
      },
      {
        platform: 'facebook',
        count: 5,
        avgEngagementRate: 0.06,
        avgClickThroughRate: 0.025,
        totalEngagement: 80,
        avgQualityScore: 65
      }
    ],
    contentTypePerformance: [
      {
        contentType: 'social-post',
        count: 8,
        avgEngagementRate: 0.09,
        avgClickThroughRate: 0.035
      },
      {
        contentType: 'blog-post',
        count: 4,
        avgEngagementRate: 0.05,
        avgClickThroughRate: 0.02
      }
    ],
    performanceOverTime: [
      {
        date: '2024-01-15',
        count: 3,
        avgEngagementRate: 0.08,
        avgClickThroughRate: 0.03
      },
      {
        date: '2024-01-16',
        count: 2,
        avgEngagementRate: 0.09,
        avgClickThroughRate: 0.035
      }
    ],
    topHashtags: [
      { hashtag: 'contentcreation', count: 5 },
      { hashtag: 'socialmedia', count: 3 }
    ],
    bestPostingHours: [
      {
        hour: 10,
        count: 4,
        avgEngagementRate: 0.12
      },
      {
        hour: 14,
        count: 3,
        avgEngagementRate: 0.09
      }
    ],
    performanceDistribution: [
      { category: 'high', count: 3 },
      { category: 'medium', count: 5 },
      { category: 'low', count: 2 }
    ],
    insights: ['Your content performs best on twitter']
  });

  const createMockTrendingPatterns = () => ({
    trendingHashtags: [
      {
        hashtag: 'trending2024',
        count: 15,
        avgEngagement: 0.15,
        trendScore: 2.25
      }
    ],
    highPerformingContent: [
      {
        contentId: 'content-123',
        maxEngagementRate: 0.18,
        maxClickThroughRate: 0.08,
        platform: 'twitter',
        contentType: 'social-post'
      }
    ],
    platformTrends: [
      {
        platform: 'twitter',
        trend: [
          {
            date: '2024-01-15',
            avgEngagement: 0.08
          }
        ]
      }
    ]
  });

  describe('identifyPerformancePatterns', () => {
    it('should identify performance patterns successfully', async () => {
      // Arrange
      const userId = 'user-123';
      const mockInsights = createMockInsights();
      const mockTrendingPatterns = createMockTrendingPatterns();

      mockOpenSearchService.getUserInsights.mockResolvedValue(mockInsights);
      mockOpenSearchService.getTrendingPatterns.mockResolvedValue(mockTrendingPatterns);

      // Act
      const result = await service.identifyPerformancePatterns(userId);

      // Assert
      expect(result).toEqual({
        userId,
        analysisDate: expect.any(String),
        timeRange: {
          from: null,
          to: null
        },
        platformPatterns: expect.arrayContaining([
          expect.objectContaining({
            platform: 'twitter',
            contentCount: 10,
            avgEngagementRate: 0.08,
            avgClickThroughRate: 0.03,
            performanceScore: expect.any(Number),
            patternType: expect.stringMatching(/high_performer|consistent|variable|underperformer/),
            insights: expect.any(Array)
          })
        ]),
        contentTypePatterns: expect.arrayContaining([
          expect.objectContaining({
            contentType: 'social-post',
            contentCount: 8,
            avgEngagementRate: 0.09,
            avgClickThroughRate: 0.035,
            effectivenessScore: expect.any(Number),
            recommendation: expect.any(String)
          })
        ]),
        temporalPatterns: expect.objectContaining({
          bestHours: expect.any(Array),
          dayOfWeekPatterns: expect.any(Array),
          postingFrequency: expect.any(Object),
          insights: expect.any(Array)
        }),
        hashtagPatterns: expect.objectContaining({
          topPerformingHashtags: expect.any(Array),
          underutilizedHashtags: expect.any(Array),
          trendingOpportunities: expect.any(Array),
          insights: expect.any(Array)
        }),
        engagementPatterns: expect.objectContaining({
          avgEngagementRate: expect.any(Number),
          consistency: expect.stringMatching(/high|medium|low/),
          highPerformanceRate: expect.any(Number),
          engagementTypes: expect.any(Array),
          patterns: expect.any(Array)
        }),
        successFactors: expect.any(Array),
        recommendations: expect.any(Array)
      });

      expect(mockOpenSearchService.getUserInsights).toHaveBeenCalledWith(userId, {
        dateFrom: undefined,
        dateTo: undefined,
        platform: undefined,
        timeInterval: 'day'
      });
      expect(mockOpenSearchService.getTrendingPatterns).toHaveBeenCalledWith({
        dateFrom: undefined,
        platform: undefined
      });
    });

    it('should handle options correctly', async () => {
      // Arrange
      const userId = 'user-123';
      const options = {
        platform: 'twitter' as any,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        timeInterval: 'week'
      };
      const mockInsights = createMockInsights();
      const mockTrendingPatterns = createMockTrendingPatterns();

      mockOpenSearchService.getUserInsights.mockResolvedValue(mockInsights);
      mockOpenSearchService.getTrendingPatterns.mockResolvedValue(mockTrendingPatterns);

      // Act
      const result = await service.identifyPerformancePatterns(userId, options);

      // Assert
      expect(result.timeRange).toEqual({
        from: '2024-01-01',
        to: '2024-01-31'
      });

      expect(mockOpenSearchService.getUserInsights).toHaveBeenCalledWith(userId, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
        platform: 'twitter',
        timeInterval: 'week'
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      mockOpenSearchService.getUserInsights.mockRejectedValue(new Error('OpenSearch error'));

      // Act & Assert
      await expect(service.identifyPerformancePatterns(userId)).rejects.toThrow('Failed to identify performance patterns');
    });
  });

  describe('analyzeSuccessfulContent', () => {
    it('should analyze successful content characteristics', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSearchResult = {
        total: 1,
        hits: [
          {
            id: 'content-123',
            source: {
              contentId: 'content-123',
              userId: 'user-123',
              platform: 'twitter',
              contentType: 'social-post',
              wordCount: 25,
              hashtags: ['contentcreation', 'socialmedia'],
              seoKeywords: ['content', 'social', 'media'],
              metrics: {
                engagementRate: 0.15,
                clickThroughRate: 0.08,
                likes: 100,
                shares: 20,
                comments: 10
              },
              timestamp: '2024-01-15T10:00:00.000Z'
            },
            score: 1.0
          }
        ],
        aggregations: {}
      };

      mockOpenSearchService.searchFeedback.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service.analyzeSuccessfulContent(userId);

      // Assert
      expect(result).toEqual({
        userId,
        analysisDate: expect.any(String),
        criteria: {
          minEngagementRate: 0.1,
          minClickThroughRate: 0.05,
          platform: null,
          contentType: null
        },
        highPerformingContent: expect.any(Array),
        characteristics: expect.objectContaining({
          avgWordCount: expect.any(Number),
          commonHashtags: expect.any(Array),
          avgHashtagCount: expect.any(Number),
          commonKeywords: expect.any(Array),
          avgEngagementRate: expect.any(Number),
          avgClickThroughRate: expect.any(Number),
          platformDistribution: expect.any(Object),
          contentTypeDistribution: expect.any(Object),
          postingTimeDistribution: expect.any(Object)
        }),
        benchmarkComparison: expect.objectContaining({
          wordCountComparison: expect.any(Object),
          hashtagCountComparison: expect.any(Object),
          engagementRateComparison: expect.any(Object),
          clickThroughRateComparison: expect.any(Object)
        }),
        insights: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });

    it('should handle empty content gracefully', async () => {
      // Arrange
      const userId = 'user-123';
      const mockSearchResult = { total: 0, hits: [], aggregations: {} };

      mockOpenSearchService.searchFeedback.mockResolvedValue(mockSearchResult);

      // Act
      const result = await service.analyzeSuccessfulContent(userId);

      // Assert
      expect(result.highPerformingContent).toHaveLength(0);
      expect(result.characteristics.avgWordCount).toBe(0);
      expect(result.characteristics.commonHashtags).toHaveLength(0);
    });

    it('should apply custom criteria', async () => {
      // Arrange
      const userId = 'user-123';
      const options = {
        minEngagementRate: 0.2,
        minClickThroughRate: 0.1,
        platform: 'twitter' as any,
        contentType: 'social-post'
      };

      mockOpenSearchService.searchFeedback.mockResolvedValue({ total: 0, hits: [], aggregations: {} });

      // Act
      const result = await service.analyzeSuccessfulContent(userId, options);

      // Assert
      expect(result.criteria).toEqual({
        minEngagementRate: 0.2,
        minClickThroughRate: 0.1,
        platform: 'twitter',
        contentType: 'social-post'
      });
    });
  });

  describe('generateTrendAnalysis', () => {
    it('should generate comprehensive trend analysis', async () => {
      // Arrange
      const userId = 'user-123';
      const mockInsights = createMockInsights();
      const mockTrendingPatterns = createMockTrendingPatterns();

      mockOpenSearchService.getUserInsights.mockResolvedValue(mockInsights);
      mockOpenSearchService.getTrendingPatterns.mockResolvedValue(mockTrendingPatterns);

      // Act
      const result = await service.generateTrendAnalysis(userId);

      // Assert
      expect(result).toEqual({
        userId,
        analysisDate: expect.any(String),
        timeRange: {
          from: null,
          to: null,
          interval: 'day'
        },
        overallTrend: expect.any(String),
        platformTrends: expect.any(Object),
        seasonalPatterns: expect.any(Object),
        momentum: expect.any(Object),
        forecasts: expect.any(Object),
        trendingTopics: expect.any(Array),
        insights: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });

    it('should handle insufficient data for trends', async () => {
      // Arrange
      const userId = 'user-123';
      const mockInsights = {
        ...createMockInsights(),
        performanceOverTime: [] // No data
      };
      const mockTrendingPatterns = createMockTrendingPatterns();

      mockOpenSearchService.getUserInsights.mockResolvedValue(mockInsights);
      mockOpenSearchService.getTrendingPatterns.mockResolvedValue(mockTrendingPatterns);

      // Act
      const result = await service.generateTrendAnalysis(userId);

      // Assert
      expect(result.overallTrend).toBe('insufficient_data');
      expect(result.momentum.current).toBe('unknown');
    });

    it('should detect improving trends', async () => {
      // Arrange
      const userId = 'user-123';
      const mockInsights = {
        ...createMockInsights(),
        performanceOverTime: [
          { date: '2024-01-10', avgEngagementRate: 0.05 },
          { date: '2024-01-11', avgEngagementRate: 0.06 },
          { date: '2024-01-12', avgEngagementRate: 0.07 },
          { date: '2024-01-13', avgEngagementRate: 0.08 },
          { date: '2024-01-14', avgEngagementRate: 0.09 }
        ]
      };
      const mockTrendingPatterns = createMockTrendingPatterns();

      mockOpenSearchService.getUserInsights.mockResolvedValue(mockInsights);
      mockOpenSearchService.getTrendingPatterns.mockResolvedValue(mockTrendingPatterns);

      // Act
      const result = await service.generateTrendAnalysis(userId);

      // Assert
      expect(result.overallTrend).toBe('improving');
    });
  });

  describe('Platform Pattern Analysis', () => {
    it('should categorize high performing platforms', () => {
      // Arrange
      const platformPerformance = [
        {
          platform: 'twitter',
          count: 15,
          avgEngagementRate: 0.12, // High engagement
          avgClickThroughRate: 0.06, // High CTR
          totalEngagement: 200,
          avgQualityScore: 85
        }
      ];

      // Act
      const patterns = (service as any).analyzePlatformPatterns(platformPerformance);

      // Assert
      expect(patterns[0].patternType).toBe('high_performer');
      expect(patterns[0].performanceScore).toBeGreaterThan(0.08);
      expect(patterns[0].insights.length).toBeGreaterThan(0);
    });

    it('should categorize underperforming platforms', () => {
      // Arrange
      const platformPerformance = [
        {
          platform: 'facebook',
          count: 10,
          avgEngagementRate: 0.02, // Low engagement
          avgClickThroughRate: 0.01, // Low CTR
          totalEngagement: 30,
          avgQualityScore: 45
        }
      ];

      // Act
      const patterns = (service as any).analyzePlatformPatterns(platformPerformance);

      // Assert
      expect(patterns[0].patternType).toBe('underperformer');
      expect(patterns[0].performanceScore).toBeLessThan(0.05);
    });

    it('should categorize variable performance platforms', () => {
      // Arrange
      const platformPerformance = [
        {
          platform: 'instagram',
          count: 3, // Low content count
          avgEngagementRate: 0.08,
          avgClickThroughRate: 0.04,
          totalEngagement: 50,
          avgQualityScore: 70
        }
      ];

      // Act
      const patterns = (service as any).analyzePlatformPatterns(platformPerformance);

      // Assert
      expect(patterns[0].patternType).toBe('variable');
    });
  });

  describe('Content Type Pattern Analysis', () => {
    it('should analyze content type effectiveness', () => {
      // Arrange
      const contentTypePerformance = [
        {
          contentType: 'social-post',
          count: 12,
          avgEngagementRate: 0.1,
          avgClickThroughRate: 0.05
        },
        {
          contentType: 'blog-post',
          count: 5,
          avgEngagementRate: 0.03,
          avgClickThroughRate: 0.02
        }
      ];

      // Act
      const patterns = (service as any).analyzeContentTypePatterns(contentTypePerformance);

      // Assert
      expect(patterns[0].effectivenessScore).toBeGreaterThan(patterns[1].effectivenessScore);
      expect(patterns[0].recommendation).toContain('Highly effective');
      expect(patterns[1].recommendation).toContain('Low effectiveness');
    });
  });

  describe('Temporal Pattern Analysis', () => {
    it('should analyze posting time patterns', () => {
      // Arrange
      const performanceOverTime = [
        { date: '2024-01-15', avgEngagementRate: 0.08 },
        { date: '2024-01-16', avgEngagementRate: 0.09 },
        { date: '2024-01-17', avgEngagementRate: 0.07 }
      ];
      const bestPostingHours = [
        { hour: 10, count: 5, avgEngagementRate: 0.12 },
        { hour: 14, count: 3, avgEngagementRate: 0.09 }
      ];

      // Act
      const patterns = (service as any).analyzeTemporalPatterns(performanceOverTime, bestPostingHours);

      // Assert
      expect(patterns.bestHours).toHaveLength(2);
      expect(patterns.bestHours[0].effectiveness).toBe('high');
      expect(patterns.bestHours[1].effectiveness).toBe('medium');
      expect(patterns.postingFrequency).toBeDefined();
      expect(patterns.insights).toContain('Your content performs best when posted at 10:00');
    });

    it('should handle insufficient data for frequency analysis', () => {
      // Arrange
      const performanceOverTime = [
        { date: '2024-01-15', avgEngagementRate: 0.08 }
      ]; // Only 1 data point
      const bestPostingHours: any[] = [];

      // Act
      const patterns = (service as any).analyzeTemporalPatterns(performanceOverTime, bestPostingHours);

      // Assert
      expect(patterns.postingFrequency.consistency).toBe('insufficient_data');
      expect(patterns.postingFrequency.recommendation).toContain('Post more frequently');
    });
  });

  describe('Hashtag Pattern Analysis', () => {
    it('should analyze hashtag effectiveness', () => {
      // Arrange
      const topHashtags = [
        { hashtag: 'contentcreation', count: 15 },
        { hashtag: 'socialmedia', count: 8 },
        { hashtag: 'marketing', count: 3 }
      ];
      const trendingHashtags = [
        { hashtag: 'trending2024', trendScore: 2.5, avgEngagement: 0.15 },
        { hashtag: 'contentcreation', trendScore: 2.0, avgEngagement: 0.12 }
      ];

      // Act
      const patterns = (service as any).analyzeHashtagPatterns(topHashtags, trendingHashtags);

      // Assert
      expect(patterns.topPerformingHashtags[0].effectiveness).toBe('high');
      expect(patterns.topPerformingHashtags[2].effectiveness).toBe('low');
      expect(patterns.underutilizedHashtags).toContainEqual(
        expect.objectContaining({ hashtag: 'marketing', effectiveness: 'low' })
      );
      expect(patterns.trendingOpportunities).toContainEqual(
        expect.objectContaining({ hashtag: 'trending2024', opportunity: 'high' })
      );
    });
  });

  describe('Success Factor Identification', () => {
    it('should identify platform success factors', async () => {
      // Arrange
      const userId = 'user-123';
      const insights = createMockInsights();

      // Act
      const factors = await (service as any).identifySuccessFactors(userId, insights);

      // Assert
      expect(factors).toContainEqual(
        expect.objectContaining({
          type: 'platform',
          factor: 'twitter optimization',
          impact: 'high',
          confidence: 0.9
        })
      );
    });

    it('should identify timing success factors', async () => {
      // Arrange
      const userId = 'user-123';
      const insights = createMockInsights();

      // Act
      const factors = await (service as any).identifySuccessFactors(userId, insights);

      // Assert
      expect(factors).toContainEqual(
        expect.objectContaining({
          type: 'timing',
          factor: '10:00 posting time',
          impact: 'medium',
          confidence: 0.8
        })
      );
    });

    it('should identify hashtag success factors', async () => {
      // Arrange
      const userId = 'user-123';
      const insights = createMockInsights();

      // Act
      const factors = await (service as any).identifySuccessFactors(userId, insights);

      // Assert
      expect(factors).toContainEqual(
        expect.objectContaining({
          type: 'hashtag',
          factor: '#contentcreation usage',
          impact: 'medium',
          confidence: 0.7
        })
      );
    });
  });

  describe('Trend Analysis Methods', () => {
    it('should calculate linear trends correctly', () => {
      // Arrange
      const points = [
        { x: 0, y: 0.05 },
        { x: 1, y: 0.06 },
        { x: 2, y: 0.07 },
        { x: 3, y: 0.08 },
        { x: 4, y: 0.09 }
      ];

      // Act
      const trend = (service as any).calculateLinearTrend(points);

      // Assert
      expect(trend.slope).toBeCloseTo(0.01, 3);
      expect(trend.correlation).toBeCloseTo(1, 1);
    });

    it('should calculate momentum correctly', () => {
      // Arrange
      const performanceOverTime = [
        { avgEngagementRate: 0.05 },
        { avgEngagementRate: 0.06 },
        { avgEngagementRate: 0.07 },
        { avgEngagementRate: 0.08 },
        { avgEngagementRate: 0.09 }
      ];

      // Act
      const momentum = (service as any).calculateMomentum(performanceOverTime);

      // Assert
      expect(momentum.direction).toBe('positive');
      expect(momentum.changePercent).toBeGreaterThan(0);
    });

    it('should handle insufficient data for momentum', () => {
      // Arrange
      const performanceOverTime = [
        { avgEngagementRate: 0.05 },
        { avgEngagementRate: 0.06 }
      ];

      // Act
      const momentum = (service as any).calculateMomentum(performanceOverTime);

      // Assert
      expect(momentum.current).toBe('unknown');
      expect(momentum.strength).toBe('unknown');
    });
  });

  describe('Utility Methods', () => {
    it('should count occurrences correctly', () => {
      // Arrange
      const items = ['apple', 'banana', 'apple', 'cherry', 'banana', 'apple'];

      // Act
      const counts = (service as any).countOccurrences(items);

      // Assert
      expect(counts).toEqual({
        apple: 3,
        banana: 2,
        cherry: 1
      });
    });

    it('should calculate distribution correctly', () => {
      // Arrange
      const content = [
        { platform: 'twitter' },
        { platform: 'twitter' },
        { platform: 'facebook' },
        { platform: 'instagram' }
      ];

      // Act
      const distribution = (service as any).calculateDistribution(content, 'platform');

      // Assert
      expect(distribution).toEqual({
        twitter: 0.5,
        facebook: 0.25,
        instagram: 0.25
      });
    });

    it('should compare metrics correctly', () => {
      // Arrange
      const value1 = 100;
      const value2 = 80;

      // Act
      const comparison = (service as any).compareMetric(value1, value2);

      // Assert
      expect(comparison.difference).toBe(20);
      expect(comparison.significance).toBe('medium'); // 25% difference
    });
  });
});
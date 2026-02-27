import { FeedbackProcessingService } from '../src/services/feedback-processing';
import { engagementFeedbackService, generatedContentService } from '../src/services/database';
import { EngagementFeedback, EngagementMetrics } from '../src/types';

// Mock the database services
jest.mock('../src/services/database');

const mockEngagementFeedbackService = engagementFeedbackService as jest.Mocked<typeof engagementFeedbackService>;
const mockGeneratedContentService = generatedContentService as jest.Mocked<typeof generatedContentService>;

describe('FeedbackProcessingService', () => {
  let service: FeedbackProcessingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeedbackProcessingService();
  });

  const createMockFeedback = (overrides: Partial<EngagementFeedback> = {}): EngagementFeedback => ({
    feedbackId: 'feedback-123',
    contentId: 'content-123',
    userId: 'user-123',
    platform: 'twitter',
    metrics: {
      likes: 50,
      shares: 10,
      comments: 5,
      clickThroughRate: 0.03,
      engagementRate: 0.08,
      impressions: 1000,
      reach: 800
    },
    timestamp: '2024-01-15T10:00:00.000Z',
    ...overrides
  });

  const createMockContent = (overrides: any = {}) => ({
    contentId: 'content-123',
    userId: 'user-123',
    platform: 'twitter',
    contentType: 'social-post',
    generatedText: 'Test content for engagement',
    metadata: {
      wordCount: 25,
      hashtags: ['#test', '#content'],
      seoKeywords: ['test', 'content', 'engagement'],
      brandVoice: 'professional'
    },
    createdAt: '2024-01-15T09:00:00.000Z',
    ...overrides
  });

  describe('processFeedback', () => {
    it('should successfully process valid feedback', async () => {
      // Arrange
      const feedback = createMockFeedback();
      const content = createMockContent();
      mockGeneratedContentService.getContent = jest.fn().mockResolvedValue(content);

      // Act
      const result = await service.processFeedback(feedback);

      // Assert
      expect(result).toEqual({
        feedback,
        content,
        derivedMetrics: {
          totalEngagement: 65,
          engagementScore: expect.any(Number),
          viralityCoefficient: expect.any(Number),
          interactionDepth: expect.any(Number),
          engagementPerImpression: 0.065,
          engagementPerReach: 0.08125,
          engagementPerWord: 2.6,
          performanceCategory: 'medium',
          qualityScore: expect.any(Number)
        },
        performanceAnalysis: expect.objectContaining({
          platform: 'twitter',
          benchmarkComparison: expect.any(Object),
          strengths: expect.any(Array),
          weaknesses: expect.any(Array),
          recommendations: expect.any(Array)
        }),
        insights: expect.arrayContaining([
          expect.stringContaining('medium performance on twitter')
        ]),
        processedAt: expect.any(String)
      });
    });

    it('should throw error for non-existent content', async () => {
      // Arrange
      const feedback = createMockFeedback();
      mockGeneratedContentService.getContent = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.processFeedback(feedback)).rejects.toThrow('Content not found');
    });

    it('should throw error for invalid metrics', async () => {
      // Arrange
      const feedback = createMockFeedback({
        metrics: {
          likes: -5, // Invalid negative value
          shares: 10,
          comments: 5,
          clickThroughRate: 0.03,
          engagementRate: 0.08
        }
      });

      // Act & Assert
      await expect(service.processFeedback(feedback)).rejects.toThrow('Invalid metrics');
    });
  });

  describe('validateMetrics', () => {
    it('should validate correct metrics', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08,
        impressions: 1000,
        reach: 800
      };

      // Act
      const result = service.validateMetrics(metrics);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      // Arrange
      const metrics = {
        likes: 50,
        // Missing shares, comments, clickThroughRate, engagementRate
      } as EngagementMetrics;

      // Act
      const result = service.validateMetrics(metrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required field: shares');
      expect(result.errors).toContain('Missing required field: comments');
      expect(result.errors).toContain('Missing required field: clickThroughRate');
      expect(result.errors).toContain('Missing required field: engagementRate');
    });

    it('should reject negative values', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: -5,
        shares: -2,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
      };

      // Act
      const result = service.validateMetrics(metrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('likes must be a non-negative number');
      expect(result.errors).toContain('shares must be a non-negative number');
    });

    it('should reject invalid rate values', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 1.5, // > 1
        engagementRate: -0.1 // < 0
      };

      // Act
      const result = service.validateMetrics(metrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('clickThroughRate must be between 0 and 1');
      expect(result.errors).toContain('engagementRate must be between 0 and 1');
    });

    it('should validate optional fields when present', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08,
        impressions: -100, // Invalid negative
        reach: 'invalid' as any // Invalid type
      };

      // Act
      const result = service.validateMetrics(metrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('impressions must be a non-negative number if provided');
      expect(result.errors).toContain('reach must be a non-negative number if provided');
    });
  });

  describe('calculateDerivedMetrics', () => {
    it('should calculate correct derived metrics', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08,
        impressions: 1000,
        reach: 800
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result).toEqual({
        totalEngagement: 65,
        engagementScore: expect.any(Number),
        viralityCoefficient: 10/65, // shares / total engagement
        interactionDepth: 5/50, // comments / likes
        engagementPerImpression: 65/1000,
        engagementPerReach: 65/800,
        engagementPerWord: 65/25, // total engagement / word count
        performanceCategory: 'medium',
        qualityScore: expect.any(Number)
      });
    });

    it('should handle zero values gracefully', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 0,
        shares: 0,
        comments: 0,
        clickThroughRate: 0,
        engagementRate: 0
      };
      const content = createMockContent({ metadata: { wordCount: 0 } });

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.totalEngagement).toBe(0);
      expect(result.viralityCoefficient).toBe(0);
      expect(result.interactionDepth).toBe(0);
      expect(result.engagementPerWord).toBe(0);
      expect(result.performanceCategory).toBe('poor');
    });

    it('should handle missing optional metrics', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
        // Missing impressions and reach
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.engagementPerImpression).toBe(0);
      expect(result.engagementPerReach).toBe(0);
      expect(result.totalEngagement).toBe(65);
    });
  });

  describe('analyzePerformance', () => {
    it('should analyze performance against platform benchmarks', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
      };

      // Act
      const result = service.analyzePerformance(metrics, 'twitter');

      // Assert
      expect(result).toEqual({
        platform: 'twitter',
        benchmarkComparison: expect.objectContaining({
          engagementRate: expect.objectContaining({
            value: 0.08,
            benchmark: expect.any(Number),
            ratio: expect.any(Number),
            performance: expect.stringMatching(/above|at|below/)
          })
        }),
        strengths: expect.any(Array),
        weaknesses: expect.any(Array),
        recommendations: expect.any(Array)
      });
    });

    it('should identify strengths for above-benchmark performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 100, // High likes
        shares: 50, // High shares
        comments: 25, // High comments
        clickThroughRate: 0.05, // Above Twitter benchmark
        engagementRate: 0.15 // Well above Twitter benchmark
      };

      // Act
      const result = service.analyzePerformance(metrics, 'twitter');

      // Assert
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.strengths.some(s => s.includes('above platform average'))).toBe(true);
    });

    it('should identify weaknesses for below-benchmark performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 5, // Low likes
        shares: 1, // Low shares
        comments: 0, // Low comments
        clickThroughRate: 0.005, // Below Twitter benchmark
        engagementRate: 0.01 // Below Twitter benchmark
      };

      // Act
      const result = service.analyzePerformance(metrics, 'twitter');

      // Assert
      expect(result.weaknesses.length).toBeGreaterThan(0);
      expect(result.weaknesses.some(w => w.includes('below platform average'))).toBe(true);
    });

    it('should provide platform-specific recommendations', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 10,
        shares: 2,
        comments: 1,
        clickThroughRate: 0.01,
        engagementRate: 0.02
      };

      // Act
      const result = service.analyzePerformance(metrics, 'twitter');

      // Assert
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(r => 
        r.includes('hashtags') || r.includes('engagement') || r.includes('posting')
      )).toBe(true);
    });
  });

  describe('getUserFeedbackSummary', () => {
    it('should generate comprehensive feedback summary', async () => {
      // Arrange
      const userId = 'user-123';
      const mockFeedbackData = [
        createMockFeedback({ platform: 'twitter' }),
        createMockFeedback({ 
          platform: 'facebook',
          metrics: { ...createMockFeedback().metrics, engagementRate: 0.12 }
        }),
        createMockFeedback({ platform: 'instagram' })
      ];

      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedbackData);

      // Act
      const result = await service.getUserFeedbackSummary(userId, 30);

      // Assert
      expect(result).toEqual({
        userId,
        period: '30 days',
        totalContent: 3,
        totalEngagement: expect.any(Number),
        averageEngagementRate: expect.any(Number),
        averageClickThroughRate: expect.any(Number),
        platformBreakdown: expect.objectContaining({
          twitter: expect.any(Object),
          facebook: expect.any(Object),
          instagram: expect.any(Object)
        }),
        topPerformingContent: expect.any(Array),
        insights: expect.any(Array)
      });
    });

    it('should handle empty feedback data', async () => {
      // Arrange
      const userId = 'user-123';
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);

      // Act
      const result = await service.getUserFeedbackSummary(userId, 30);

      // Assert
      expect(result).toEqual({
        userId,
        period: '30 days',
        totalContent: 0,
        totalEngagement: 0,
        averageEngagementRate: 0,
        averageClickThroughRate: 0,
        platformBreakdown: {},
        topPerformingContent: [],
        insights: ['No engagement data available for this period']
      });
    });

    it('should filter feedback by date range', async () => {
      // Arrange
      const userId = 'user-123';
      const oldFeedback = createMockFeedback({ 
        timestamp: '2023-12-01T10:00:00.000Z' // Old feedback
      });
      const recentFeedback = createMockFeedback({ 
        timestamp: '2024-01-15T10:00:00.000Z' // Recent feedback
      });

      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([oldFeedback, recentFeedback]);

      // Act
      const result = await service.getUserFeedbackSummary(userId, 30);

      // Assert
      // Should only include recent feedback (within 30 days)
      expect(result.totalContent).toBe(1);
    });
  });

  describe('generateInsights', () => {
    it('should generate relevant insights from feedback data', async () => {
      // Arrange
      const feedback = createMockFeedback({
        metrics: {
          likes: 100,
          shares: 50, // High share rate (50%)
          comments: 30, // High comment rate (30%)
          clickThroughRate: 0.05,
          engagementRate: 0.15
        }
      });
      const content = createMockContent({
        metadata: {
          wordCount: 20,
          hashtags: ['#viral', '#trending', '#content']
        }
      });

      // Act
      const result = await service.generateInsights(feedback, content);

      // Assert
      expect(result).toContain('This content achieved high performance on twitter');
      expect(result.some(insight => insight.includes('viral potential'))).toBe(true);
      expect(result.some(insight => insight.includes('audience engagement'))).toBe(true);
      expect(result.some(insight => insight.includes('hashtags'))).toBe(true);
    });

    it('should provide time-based insights', async () => {
      // Arrange
      const morningFeedback = createMockFeedback({
        timestamp: '2024-01-15T10:00:00.000Z' // 10 AM
      });
      const eveningFeedback = createMockFeedback({
        timestamp: '2024-01-15T20:00:00.000Z' // 8 PM
      });
      const content = createMockContent();

      // Act
      const morningInsights = await service.generateInsights(morningFeedback, content);
      const eveningInsights = await service.generateInsights(eveningFeedback, content);

      // Assert
      expect(morningInsights.some(insight => 
        insight.includes('peak morning engagement')
      )).toBe(true);
      expect(eveningInsights.some(insight => 
        insight.includes('peak evening engagement')
      )).toBe(true);
    });

    it('should analyze content efficiency', async () => {
      // Arrange
      const feedback = createMockFeedback({
        metrics: {
          likes: 200,
          shares: 50,
          comments: 25,
          clickThroughRate: 0.08,
          engagementRate: 0.12
        }
      });
      const content = createMockContent({
        metadata: {
          wordCount: 15 // Short content with high engagement
        }
      });

      // Act
      const result = await service.generateInsights(feedback, content);

      // Assert
      expect(result.some(insight => 
        insight.includes('concise, impactful content')
      )).toBe(true);
    });
  });

  describe('Performance categorization', () => {
    it('should categorize exceptional performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 1000,
        shares: 200,
        comments: 100,
        clickThroughRate: 0.1, // 10%
        engagementRate: 0.2 // 20%
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('exceptional');
    });

    it('should categorize high performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 500,
        shares: 75,
        comments: 50,
        clickThroughRate: 0.06, // 6%
        engagementRate: 0.12 // 12%
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('high');
    });

    it('should categorize medium performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 100,
        shares: 20,
        comments: 10,
        clickThroughRate: 0.03, // 3%
        engagementRate: 0.07 // 7%
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('medium');
    });

    it('should categorize low performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 20,
        shares: 2,
        comments: 1,
        clickThroughRate: 0.015, // 1.5%
        engagementRate: 0.03 // 3%
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('low');
    });

    it('should categorize poor performance', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 5,
        shares: 0,
        comments: 0,
        clickThroughRate: 0.005, // 0.5%
        engagementRate: 0.01 // 1%
      };
      const content = createMockContent();

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('poor');
    });
  });
});
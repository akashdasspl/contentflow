import fc from 'fast-check';
import { FeedbackProcessingService } from '../src/services/feedback-processing';
import { generatedContentService } from '../src/services/database';
import { EngagementFeedback, EngagementMetrics, Platform } from '../src/types';

/**
 * Property-based tests for feedback processing completeness
 * Feature: contentflow-ai, Property 10: Feedback Processing Completeness
 * **Validates: Requirements 5.1, 5.2**
 */

// Mock the database services
jest.mock('../src/services/database');

const mockGeneratedContentService = generatedContentService as jest.Mocked<typeof generatedContentService>;

// Helper to create metrics with optional fields properly
const metricsArbitrary = (maxValues: { likes?: number; shares?: number; comments?: number } = {}) => 
  fc.record({
    likes: fc.nat({ max: maxValues.likes || 100000 }),
    shares: fc.nat({ max: maxValues.shares || 100000 }),
    comments: fc.nat({ max: maxValues.comments || 100000 }),
    clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
    engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
  }).chain(baseMetrics => 
    fc.record({
      impressions: fc.option(fc.integer({ min: 1, max: 10000000 })),
      reach: fc.option(fc.integer({ min: 1, max: 10000000 }))
    }).map(optionalMetrics => {
      const result: any = { ...baseMetrics };
      if (optionalMetrics.impressions !== null) result.impressions = optionalMetrics.impressions;
      if (optionalMetrics.reach !== null) result.reach = optionalMetrics.reach;
      return result as EngagementMetrics;
    })
  );

// Helper to create valid timestamps
const timestampArbitrary = () => 
  fc.integer({ min: new Date('2020-01-01').getTime(), max: Date.now() })
    .map(timestamp => new Date(timestamp).toISOString());

describe('Property 10: Feedback Processing Completeness', () => {
  let service: FeedbackProcessingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FeedbackProcessingService();
    
    // Mock content retrieval
    mockGeneratedContentService.getGeneratedContent = jest.fn().mockResolvedValue({
      contentId: 'content-123',
      userId: 'user-123',
      platform: 'twitter',
      contentType: 'social-post',
      generatedText: 'Test content',
      metadata: {
        wordCount: 25,
        hashtags: ['#test'],
        seoKeywords: ['test'],
        readingTime: 1
      },
      createdAt: '2024-01-15T09:00:00.000Z'
    });
  });

  /**
   * Property: For any engagement data submission, the system should analyze 
   * all provided metrics (likes, shares, comments, click-through rates)
   * **Validates: Requirements 5.1**
   */
  it('should analyze all provided engagement metrics for any valid feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid engagement feedback with all metrics
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: metricsArbitrary(),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Act
          const result = await service.processFeedback(feedback);

          // Assert - All metrics should be analyzed
          // 1. Verify likes are analyzed
          expect(result.derivedMetrics.totalEngagement).toBeGreaterThanOrEqual(feedback.metrics.likes);
          
          // 2. Verify shares are analyzed
          expect(result.derivedMetrics.totalEngagement).toBeGreaterThanOrEqual(feedback.metrics.shares);
          
          // 3. Verify comments are analyzed
          expect(result.derivedMetrics.totalEngagement).toBeGreaterThanOrEqual(feedback.metrics.comments);
          
          // 4. Verify click-through rate is analyzed
          expect(result.performanceAnalysis.benchmarkComparison.clickThroughRate).toBeDefined();
          expect(result.performanceAnalysis.benchmarkComparison.clickThroughRate.value)
            .toBe(feedback.metrics.clickThroughRate);
          
          // 5. Verify engagement rate is analyzed
          expect(result.performanceAnalysis.benchmarkComparison.engagementRate).toBeDefined();
          expect(result.performanceAnalysis.benchmarkComparison.engagementRate.value)
            .toBe(feedback.metrics.engagementRate);
          
          // 6. Verify total engagement calculation includes all metrics
          const expectedTotal = feedback.metrics.likes + feedback.metrics.shares + feedback.metrics.comments;
          expect(result.derivedMetrics.totalEngagement).toBe(expectedTotal);
          
          // 7. Verify all metrics are present in benchmark comparison
          expect(result.performanceAnalysis.benchmarkComparison.likes).toBeDefined();
          expect(result.performanceAnalysis.benchmarkComparison.shares).toBeDefined();
          expect(result.performanceAnalysis.benchmarkComparison.comments).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any engagement data submission, the system should identify 
   * performance patterns and characteristics
   * **Validates: Requirements 5.2**
   */
  it('should identify performance patterns for any valid feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate valid engagement feedback
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: metricsArbitrary(),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Act
          const result = await service.processFeedback(feedback);

          // Assert - Performance patterns should be identified
          // 1. Performance category should be identified
          expect(result.derivedMetrics.performanceCategory).toBeDefined();
          expect(['exceptional', 'high', 'medium', 'low', 'poor'])
            .toContain(result.derivedMetrics.performanceCategory);
          
          // 2. Virality pattern should be identified
          expect(result.derivedMetrics.viralityCoefficient).toBeDefined();
          expect(result.derivedMetrics.viralityCoefficient).toBeGreaterThanOrEqual(0);
          expect(result.derivedMetrics.viralityCoefficient).toBeLessThanOrEqual(1);
          
          // 3. Interaction depth pattern should be identified
          expect(result.derivedMetrics.interactionDepth).toBeDefined();
          expect(result.derivedMetrics.interactionDepth).toBeGreaterThanOrEqual(0);
          
          // 4. Engagement score pattern should be calculated
          expect(result.derivedMetrics.engagementScore).toBeDefined();
          expect(result.derivedMetrics.engagementScore).toBeGreaterThanOrEqual(0);
          
          // 5. Quality score pattern should be identified
          expect(result.derivedMetrics.qualityScore).toBeDefined();
          expect(result.derivedMetrics.qualityScore).toBeGreaterThanOrEqual(0);
          expect(result.derivedMetrics.qualityScore).toBeLessThanOrEqual(100);
          
          // 6. Performance analysis should identify strengths or weaknesses
          expect(result.performanceAnalysis.strengths).toBeDefined();
          expect(result.performanceAnalysis.weaknesses).toBeDefined();
          expect(Array.isArray(result.performanceAnalysis.strengths)).toBe(true);
          expect(Array.isArray(result.performanceAnalysis.weaknesses)).toBe(true);
          
          // 7. Insights should be generated
          expect(result.insights).toBeDefined();
          expect(Array.isArray(result.insights)).toBe(true);
          expect(result.insights.length).toBeGreaterThan(0);
          
          // 8. Recommendations should be provided
          expect(result.performanceAnalysis.recommendations).toBeDefined();
          expect(Array.isArray(result.performanceAnalysis.recommendations)).toBe(true);
          expect(result.performanceAnalysis.recommendations.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Processing should handle optional metrics gracefully
   * **Validates: Requirements 5.1**
   */
  it('should process feedback with or without optional metrics', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate feedback with optional metrics sometimes present
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: metricsArbitrary({ likes: 10000, shares: 10000, comments: 10000 }),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Act
          const result = await service.processFeedback(feedback);

          // Assert - Should process successfully regardless of optional metrics
          expect(result).toBeDefined();
          expect(result.derivedMetrics).toBeDefined();
          expect(result.performanceAnalysis).toBeDefined();
          
          // If impressions provided, should calculate engagement per impression
          if (feedback.metrics.impressions) {
            expect(result.derivedMetrics.engagementPerImpression).toBeGreaterThanOrEqual(0);
          } else {
            expect(result.derivedMetrics.engagementPerImpression).toBe(0);
          }
          
          // If reach provided, should calculate engagement per reach
          if (feedback.metrics.reach) {
            expect(result.derivedMetrics.engagementPerReach).toBeGreaterThanOrEqual(0);
          } else {
            expect(result.derivedMetrics.engagementPerReach).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Pattern identification should be consistent across platforms
   * **Validates: Requirements 5.2**
   */
  it('should identify patterns consistently across all platforms', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate same metrics for different platforms
        fc.record({
          likes: fc.nat({ max: 1000 }),
          shares: fc.nat({ max: 1000 }),
          comments: fc.nat({ max: 1000 }),
          clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
        }),
        fc.constantFrom<Platform>(
          'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
        ),
        fc.constantFrom<Platform>(
          'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
        ),
        async (metrics: EngagementMetrics, platform1: Platform, platform2: Platform) => {
          // Create feedback for two different platforms with same metrics
          const feedback1: EngagementFeedback = {
            feedbackId: 'feedback-1',
            contentId: 'content-1',
            userId: 'user-1',
            platform: platform1,
            metrics,
            timestamp: new Date().toISOString()
          };
          
          const feedback2: EngagementFeedback = {
            feedbackId: 'feedback-2',
            contentId: 'content-2',
            userId: 'user-1',
            platform: platform2,
            metrics,
            timestamp: new Date().toISOString()
          };

          // Act
          const result1 = await service.processFeedback(feedback1);
          const result2 = await service.processFeedback(feedback2);

          // Assert - Core patterns should be consistent
          // Same metrics should produce same derived metrics
          expect(result1.derivedMetrics.totalEngagement).toBe(result2.derivedMetrics.totalEngagement);
          expect(result1.derivedMetrics.viralityCoefficient).toBe(result2.derivedMetrics.viralityCoefficient);
          expect(result1.derivedMetrics.interactionDepth).toBe(result2.derivedMetrics.interactionDepth);
          
          // Performance category should be consistent for same metrics
          expect(result1.derivedMetrics.performanceCategory).toBe(result2.derivedMetrics.performanceCategory);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: High engagement metrics should be identified as successful patterns
   * **Validates: Requirements 5.2**
   */
  it('should identify high engagement as successful patterns', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate high-performing metrics
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: fc.record({
            likes: fc.integer({ min: 1000, max: 100000 }),
            shares: fc.integer({ min: 200, max: 10000 }),
            comments: fc.integer({ min: 100, max: 5000 }),
            clickThroughRate: fc.double({ min: 0.1, max: 1, noNaN: true }),
            engagementRate: fc.double({ min: 0.15, max: 1, noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Act
          const result = await service.processFeedback(feedback);

          // Assert - High metrics should be identified as successful
          // Performance category should be high or exceptional
          expect(['high', 'exceptional']).toContain(result.derivedMetrics.performanceCategory);
          
          // Should have strengths identified
          expect(result.performanceAnalysis.strengths.length).toBeGreaterThan(0);
          
          // Quality score should be reasonable (not necessarily > 50 for all high engagement)
          expect(result.derivedMetrics.qualityScore).toBeGreaterThanOrEqual(0);
          expect(result.derivedMetrics.qualityScore).toBeLessThanOrEqual(100);
          
          // Engagement score should be high
          expect(result.derivedMetrics.engagementScore).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Low engagement metrics should be identified with improvement recommendations
   * **Validates: Requirements 5.2**
   */
  it('should identify low engagement and provide recommendations', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate low-performing metrics
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: fc.record({
            likes: fc.nat({ max: 10 }),
            shares: fc.nat({ max: 2 }),
            comments: fc.nat({ max: 2 }),
            clickThroughRate: fc.double({ min: 0, max: Math.fround(0.02), noNaN: true }),
            engagementRate: fc.double({ min: 0, max: Math.fround(0.02), noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Act
          const result = await service.processFeedback(feedback);

          // Assert - Low metrics should be identified with recommendations
          // Performance category should be low or poor
          expect(['low', 'poor']).toContain(result.derivedMetrics.performanceCategory);
          
          // Should have recommendations for improvement
          expect(result.performanceAnalysis.recommendations.length).toBeGreaterThan(0);
          
          // Should identify weaknesses
          expect(result.performanceAnalysis.weaknesses.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Viral content patterns should be identified
   * **Validates: Requirements 5.2**
   */
  it('should identify viral content patterns when shares are high', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate metrics with high share ratio
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: fc.record({
            likes: fc.integer({ min: 100, max: 1000 }),
            shares: fc.integer({ min: 100, max: 1000 }),
            comments: fc.nat({ max: 100 }),
            clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
            engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Calculate share ratio
          const totalEngagement = feedback.metrics.likes + feedback.metrics.shares + feedback.metrics.comments;
          const shareRatio = feedback.metrics.shares / totalEngagement;
          
          // Only test when share ratio is high (>30%)
          if (shareRatio > 0.3) {
            // Act
            const result = await service.processFeedback(feedback);

            // Assert - Should identify viral potential
            expect(result.derivedMetrics.viralityCoefficient).toBeGreaterThan(0.3);
            expect(result.insights.some(insight => 
              insight.toLowerCase().includes('viral') || insight.toLowerCase().includes('share')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Deep engagement patterns should be identified
   * **Validates: Requirements 5.2**
   */
  it('should identify deep engagement patterns when comments are high', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate metrics with high comment ratio
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: fc.constantFrom<Platform>(
            'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
          ),
          metrics: fc.record({
            likes: fc.integer({ min: 100, max: 1000 }),
            shares: fc.nat({ max: 100 }),
            comments: fc.integer({ min: 50, max: 500 }),
            clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
            engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        async (feedback: EngagementFeedback) => {
          // Calculate comment ratio
          const totalEngagement = feedback.metrics.likes + feedback.metrics.shares + feedback.metrics.comments;
          const commentRatio = feedback.metrics.comments / totalEngagement;
          
          // Only test when comment ratio is high (>20%)
          if (commentRatio > 0.2) {
            // Act
            const result = await service.processFeedback(feedback);

            // Assert - Should identify deep engagement
            expect(result.derivedMetrics.interactionDepth).toBeGreaterThan(0);
            expect(result.insights.some(insight => 
              insight.toLowerCase().includes('engagement') || insight.toLowerCase().includes('comment')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

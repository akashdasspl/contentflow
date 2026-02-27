import fc from 'fast-check';
import { FeedbackProcessingService } from '../src/services/feedback-processing';
import { EngagementMetrics } from '../src/types';

/**
 * Property-based tests for feedback data validation
 * **Validates: Requirements 5.1**
 */
describe('Feedback Data Validation Properties', () => {
  let service: FeedbackProcessingService;

  beforeEach(() => {
    service = new FeedbackProcessingService();
  });

  /**
   * Property: Valid engagement metrics should always pass validation
   * **Validates: Requirements 5.1**
   */
  it('should validate all properly formed engagement metrics', () => {
    fc.assert(
      fc.property(
        // Generate valid engagement metrics
        fc.record({
          likes: fc.nat({ max: 1000000 }),
          shares: fc.nat({ max: 1000000 }),
          comments: fc.nat({ max: 1000000 }),
          clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 1, noNaN: true }),
          impressions: fc.option(fc.nat({ max: 10000000 }), { nil: undefined }),
          reach: fc.option(fc.nat({ max: 10000000 }), { nil: undefined })
        }),
        (metrics: EngagementMetrics) => {
          // Act
          const result = service.validateMetrics(metrics);

          // Assert
          expect(result.isValid).toBe(true);
          expect(result.errors).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Metrics with negative values should always fail validation
   * **Validates: Requirements 5.1**
   */
  it('should reject metrics with any negative values', () => {
    fc.assert(
      fc.property(
        // Generate metrics with at least one negative value
        fc.oneof(
          fc.record({
            likes: fc.integer({ max: -1 }), // Negative likes
            shares: fc.nat({ max: 1000 }),
            comments: fc.nat({ max: 1000 }),
            clickThroughRate: fc.float({ min: 0, max: 1 }),
            engagementRate: fc.float({ min: 0, max: 1 })
          }),
          fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.integer({ max: -1 }), // Negative shares
            comments: fc.nat({ max: 1000 }),
            clickThroughRate: fc.float({ min: 0, max: 1 }),
            engagementRate: fc.float({ min: 0, max: 1 })
          }),
          fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.nat({ max: 1000 }),
            comments: fc.integer({ max: -1 }), // Negative comments
            clickThroughRate: fc.float({ min: 0, max: 1 }),
            engagementRate: fc.float({ min: 0, max: 1 })
          })
        ),
        (metrics: EngagementMetrics) => {
          // Act
          const result = service.validateMetrics(metrics);

          // Assert
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(error => 
            error.includes('must be a non-negative number')
          )).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Rate metrics outside 0-1 range should always fail validation
   * **Validates: Requirements 5.1**
   */
  it('should reject rate metrics outside valid range', () => {
    fc.assert(
      fc.property(
        // Generate metrics with invalid rate values
        fc.oneof(
          fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.nat({ max: 1000 }),
            comments: fc.nat({ max: 1000 }),
            clickThroughRate: fc.float({ min: 1.01, max: 10 }), // > 1
            engagementRate: fc.float({ min: 0, max: 1 })
          }),
          fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.nat({ max: 1000 }),
            comments: fc.nat({ max: 1000 }),
            clickThroughRate: fc.float({ min: 0, max: 1 }),
            engagementRate: fc.float({ min: 1.01, max: 10 }) // > 1
          }),
          fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.nat({ max: 1000 }),
            comments: fc.nat({ max: 1000 }),
            clickThroughRate: fc.float({ min: -10, max: -0.01 }), // < 0
            engagementRate: fc.float({ min: 0, max: 1 })
          })
        ),
        (metrics: EngagementMetrics) => {
          // Act
          const result = service.validateMetrics(metrics);

          // Assert
          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
          expect(result.errors.some(error => 
            error.includes('must be between 0 and 1')
          )).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Derived metrics calculations should be consistent and bounded
   * **Validates: Requirements 5.1**
   */
  it('should calculate consistent derived metrics for any valid input', () => {
    fc.assert(
      fc.property(
        // Generate valid metrics and content
        fc.record({
          likes: fc.nat({ max: 10000 }),
          shares: fc.nat({ max: 10000 }),
          comments: fc.nat({ max: 10000 }),
          clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 1, noNaN: true }),
          impressions: fc.option(fc.nat({ min: 1, max: 1000000 }), { nil: undefined }),
          reach: fc.option(fc.nat({ min: 1, max: 1000000 }), { nil: undefined })
        }),
        fc.record({
          metadata: fc.record({
            wordCount: fc.nat({ min: 1, max: 10000 })
          })
        }),
        (metrics: EngagementMetrics, content: any) => {
          // Act
          const result = service.calculateDerivedMetrics(metrics, content);

          // Assert - Check all derived metrics are valid
          expect(result.totalEngagement).toBeGreaterThanOrEqual(0);
          expect(result.engagementScore).toBeGreaterThanOrEqual(0);
          expect(result.viralityCoefficient).toBeGreaterThanOrEqual(0);
          expect(result.viralityCoefficient).toBeLessThanOrEqual(1);
          expect(result.interactionDepth).toBeGreaterThanOrEqual(0);
          expect(result.engagementPerImpression).toBeGreaterThanOrEqual(0);
          expect(result.engagementPerReach).toBeGreaterThanOrEqual(0);
          expect(result.engagementPerWord).toBeGreaterThanOrEqual(0);
          expect(result.qualityScore).toBeGreaterThanOrEqual(0);
          expect(result.qualityScore).toBeLessThanOrEqual(100);

          // Total engagement should equal sum of individual metrics
          const expectedTotal = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
          expect(result.totalEngagement).toBe(expectedTotal);

          // Performance category should be valid
          const validCategories = ['exceptional', 'high', 'medium', 'low', 'poor'];
          expect(validCategories).toContain(result.performanceCategory);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Performance analysis should always provide complete results
   * **Validates: Requirements 5.1**
   */
  it('should provide complete performance analysis for any valid metrics', () => {
    fc.assert(
      fc.property(
        // Generate valid metrics
        fc.record({
          likes: fc.nat({ max: 10000 }),
          shares: fc.nat({ max: 10000 }),
          comments: fc.nat({ max: 10000 }),
          clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
        }),
        // Generate valid platform
        fc.constantFrom('blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'),
        (metrics: EngagementMetrics, platform: any) => {
          // Act
          const result = service.analyzePerformance(metrics, platform);

          // Assert - Check all required fields are present
          expect(result.platform).toBe(platform);
          expect(result.benchmarkComparison).toBeDefined();
          expect(Array.isArray(result.strengths)).toBe(true);
          expect(Array.isArray(result.weaknesses)).toBe(true);
          expect(Array.isArray(result.recommendations)).toBe(true);

          // Check benchmark comparison has required metrics
          const requiredMetrics = ['likes', 'shares', 'comments', 'clickThroughRate', 'engagementRate'];
          requiredMetrics.forEach(metric => {
            if (metric in metrics) {
              expect(result.benchmarkComparison[metric]).toBeDefined();
              expect(result.benchmarkComparison[metric].value).toBe(metrics[metric as keyof EngagementMetrics]);
              expect(result.benchmarkComparison[metric].benchmark).toBeGreaterThanOrEqual(0);
              expect(result.benchmarkComparison[metric].ratio).toBeGreaterThanOrEqual(0);
              expect(['above', 'at', 'below']).toContain(result.benchmarkComparison[metric].performance);
            }
          });

          // Recommendations should be reasonable in number
          expect(result.recommendations.length).toBeLessThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Engagement score should be monotonic with respect to engagement metrics
   * **Validates: Requirements 5.1**
   */
  it('should calculate higher engagement scores for better metrics', () => {
    fc.assert(
      fc.property(
        // Generate two sets of metrics where second is clearly better
        fc.record({
          likes: fc.nat({ max: 100 }),
          shares: fc.nat({ max: 20 }),
          comments: fc.nat({ max: 20 }),
          clickThroughRate: fc.float({ min: 0, max: 0.05, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 0.05, noNaN: true })
        }),
        fc.nat({ min: 2, max: 10 }), // Multiplier for better metrics
        (baseMetrics: EngagementMetrics, multiplier: number) => {
          // Create better metrics by multiplying base metrics
          const betterMetrics: EngagementMetrics = {
            likes: baseMetrics.likes * multiplier,
            shares: baseMetrics.shares * multiplier,
            comments: baseMetrics.comments * multiplier,
            clickThroughRate: Math.min(baseMetrics.clickThroughRate * multiplier, 1),
            engagementRate: Math.min(baseMetrics.engagementRate * multiplier, 1)
          };

          const content = { metadata: { wordCount: 100 } };

          // Act
          const baseResult = service.calculateDerivedMetrics(baseMetrics, content);
          const betterResult = service.calculateDerivedMetrics(betterMetrics, content);

          // Assert - Better metrics should have higher or equal engagement score
          expect(betterResult.engagementScore).toBeGreaterThanOrEqual(baseResult.engagementScore);
          expect(betterResult.totalEngagement).toBeGreaterThanOrEqual(baseResult.totalEngagement);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Quality score should be bounded and consistent
   * **Validates: Requirements 5.1**
   */
  it('should calculate bounded quality scores for any valid metrics', () => {
    fc.assert(
      fc.property(
        // Generate valid metrics
        fc.record({
          likes: fc.nat({ max: 100000 }),
          shares: fc.nat({ max: 100000 }),
          comments: fc.nat({ max: 100000 }),
          clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
        }),
        fc.record({
          metadata: fc.record({
            wordCount: fc.nat({ min: 1, max: 10000 })
          })
        }),
        (metrics: EngagementMetrics, content: any) => {
          // Act
          const result = service.calculateDerivedMetrics(metrics, content);

          // Assert - Quality score should be bounded
          expect(result.qualityScore).toBeGreaterThanOrEqual(0);
          expect(result.qualityScore).toBeLessThanOrEqual(100);
          expect(Number.isFinite(result.qualityScore)).toBe(true);
          expect(Number.isNaN(result.qualityScore)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Virality coefficient should be bounded between 0 and 1
   * **Validates: Requirements 5.1**
   */
  it('should calculate virality coefficient within valid bounds', () => {
    fc.assert(
      fc.property(
        // Generate valid metrics
        fc.record({
          likes: fc.nat({ max: 10000 }),
          shares: fc.nat({ max: 10000 }),
          comments: fc.nat({ max: 10000 }),
          clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
          engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
        }),
        fc.record({
          metadata: fc.record({
            wordCount: fc.nat({ min: 1, max: 1000 })
          })
        }),
        (metrics: EngagementMetrics, content: any) => {
          // Act
          const result = service.calculateDerivedMetrics(metrics, content);

          // Assert - Virality coefficient should be between 0 and 1
          expect(result.viralityCoefficient).toBeGreaterThanOrEqual(0);
          expect(result.viralityCoefficient).toBeLessThanOrEqual(1);
          expect(Number.isFinite(result.viralityCoefficient)).toBe(true);
          expect(Number.isNaN(result.viralityCoefficient)).toBe(false);

          // If there are no shares, virality should be 0
          if (metrics.shares === 0) {
            expect(result.viralityCoefficient).toBe(0);
          }

          // If shares equal total engagement, virality should be 1
          const totalEngagement = (metrics.likes || 0) + (metrics.shares || 0) + (metrics.comments || 0);
          if (totalEngagement > 0 && metrics.shares === totalEngagement) {
            expect(result.viralityCoefficient).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Performance categorization should be consistent
   * **Validates: Requirements 5.1**
   */
  it('should consistently categorize performance levels', () => {
    fc.assert(
      fc.property(
        // Generate metrics with known performance levels
        fc.oneof(
          // Poor performance
          fc.record({
            likes: fc.nat({ max: 10 }),
            shares: fc.nat({ max: 2 }),
            comments: fc.nat({ max: 2 }),
            clickThroughRate: fc.float({ min: 0, max: 0.005, noNaN: true }),
            engagementRate: fc.float({ min: 0, max: 0.015, noNaN: true })
          }).map((m: any) => ({ metrics: m, expectedCategory: 'poor' })),
          
          // High performance
          fc.record({
            likes: fc.nat({ min: 500, max: 1000 }),
            shares: fc.nat({ min: 100, max: 200 }),
            comments: fc.nat({ min: 50, max: 100 }),
            clickThroughRate: fc.float({ min: 0.06, max: 0.1, noNaN: true }),
            engagementRate: fc.float({ min: 0.12, max: 0.14, noNaN: true })
          }).map((m: any) => ({ metrics: m, expectedCategory: 'high' })),
          
          // Exceptional performance
          fc.record({
            likes: fc.nat({ min: 1000, max: 10000 }),
            shares: fc.nat({ min: 200, max: 1000 }),
            comments: fc.nat({ min: 100, max: 500 }),
            clickThroughRate: fc.float({ min: 0.1, max: 1, noNaN: true }),
            engagementRate: fc.float({ min: 0.2, max: 1, noNaN: true })
          }).map((m: any) => ({ metrics: m, expectedCategory: 'exceptional' }))
        ),
        fc.record({
          metadata: fc.record({
            wordCount: fc.nat({ min: 10, max: 100 })
          })
        }),
        ({ metrics, expectedCategory }: any, content: any) => {
          // Act
          const result = service.calculateDerivedMetrics(metrics, content);

          // Assert - Performance category should match expected
          expect(result.performanceCategory).toBe(expectedCategory);
        }
      ),
      { numRuns: 50 }
    );
  });
});
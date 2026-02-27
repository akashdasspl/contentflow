import { FeedbackProcessingService } from '../src/services/feedback-processing';
import { EngagementMetrics } from '../src/types';

/**
 * Simple tests for feedback data collection service
 * **Validates: Requirements 5.1**
 */
describe('Feedback Data Collection Service', () => {
  let service: FeedbackProcessingService;

  beforeEach(() => {
    service = new FeedbackProcessingService();
  });

  describe('Metrics Validation', () => {
    it('should validate correct engagement metrics', () => {
      // Arrange
      const validMetrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08,
        impressions: 1000,
        reach: 800
      };

      // Act
      const result = service.validateMetrics(validMetrics);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject metrics with negative values', () => {
      // Arrange
      const invalidMetrics: EngagementMetrics = {
        likes: -5, // Invalid negative value
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
      };

      // Act
      const result = service.validateMetrics(invalidMetrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => 
        error.includes('must be a non-negative number')
      )).toBe(true);
    });

    it('should reject rate metrics outside valid range', () => {
      // Arrange
      const invalidMetrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 1.5, // Invalid > 1
        engagementRate: -0.1 // Invalid < 0
      };

      // Act
      const result = service.validateMetrics(invalidMetrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => 
        error.includes('must be between 0 and 1')
      )).toBe(true);
    });

    it('should require all mandatory fields', () => {
      // Arrange
      const incompleteMetrics = {
        likes: 50,
        shares: 10
        // Missing required fields: comments, clickThroughRate, engagementRate
      } as EngagementMetrics;

      // Act
      const result = service.validateMetrics(incompleteMetrics);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => 
        error.includes('Missing required field')
      )).toBe(true);
    });
  });

  describe('Derived Metrics Calculation', () => {
    it('should calculate total engagement correctly', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.totalEngagement).toBe(65); // 50 + 10 + 5
    });

    it('should calculate engagement per word correctly', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 100,
        shares: 20,
        comments: 10,
        clickThroughRate: 0.05,
        engagementRate: 0.1
      };
      const content = { metadata: { wordCount: 50 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.engagementPerWord).toBe(2.6); // 130 total engagement / 50 words
    });

    it('should calculate virality coefficient within bounds', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 40,
        shares: 20, // High share ratio
        comments: 10,
        clickThroughRate: 0.04,
        engagementRate: 0.09
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.viralityCoefficient).toBeGreaterThanOrEqual(0);
      expect(result.viralityCoefficient).toBeLessThanOrEqual(1);
      expect(result.viralityCoefficient).toBeCloseTo(20/70, 2); // shares / total engagement
    });

    it('should handle zero engagement gracefully', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 0,
        shares: 0,
        comments: 0,
        clickThroughRate: 0,
        engagementRate: 0
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.totalEngagement).toBe(0);
      expect(result.viralityCoefficient).toBe(0);
      expect(result.interactionDepth).toBe(0);
      expect(result.performanceCategory).toBe('poor');
    });
  });

  describe('Performance Categorization', () => {
    it('should categorize high performance correctly', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 200,
        shares: 40,
        comments: 20,
        clickThroughRate: 0.06, // High CTR but not exceptional
        engagementRate: 0.12 // High engagement rate but not exceptional
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('high');
    });

    it('should categorize medium performance correctly', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 100,
        shares: 20,
        comments: 10,
        clickThroughRate: 0.03, // Medium CTR
        engagementRate: 0.07 // Medium engagement rate
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('medium');
    });

    it('should categorize poor performance correctly', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 5,
        shares: 1,
        comments: 0,
        clickThroughRate: 0.005, // Low CTR
        engagementRate: 0.01 // Low engagement rate
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.performanceCategory).toBe('poor');
    });
  });

  describe('Platform Performance Analysis', () => {
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
      expect(result.platform).toBe('twitter');
      expect(result.benchmarkComparison).toBeDefined();
      expect(result.strengths).toBeDefined();
      expect(result.weaknesses).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
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
      const result = service.analyzePerformance(metrics, 'instagram');

      // Assert
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => 
        typeof rec === 'string' && rec.length > 0
      )).toBe(true);
    });

    it('should identify strengths for above-benchmark performance', () => {
      // Arrange - High performing metrics
      const metrics: EngagementMetrics = {
        likes: 200,
        shares: 50,
        comments: 30,
        clickThroughRate: 0.08, // Well above most platform benchmarks
        engagementRate: 0.15 // Well above most platform benchmarks
      };

      // Act
      const result = service.analyzePerformance(metrics, 'facebook');

      // Assert
      expect(result.strengths.length).toBeGreaterThan(0);
    });

    it('should identify weaknesses for below-benchmark performance', () => {
      // Arrange - Low performing metrics
      const metrics: EngagementMetrics = {
        likes: 2,
        shares: 0,
        comments: 0,
        clickThroughRate: 0.002, // Well below most platform benchmarks
        engagementRate: 0.005 // Well below most platform benchmarks
      };

      // Act
      const result = service.analyzePerformance(metrics, 'linkedin');

      // Assert
      expect(result.weaknesses.length).toBeGreaterThan(0);
    });
  });

  describe('Quality Score Calculation', () => {
    it('should calculate bounded quality scores', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 100,
        shares: 25,
        comments: 15,
        clickThroughRate: 0.05,
        engagementRate: 0.1
      };
      const content = { metadata: { wordCount: 50 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      expect(Number.isFinite(result.qualityScore)).toBe(true);
    });

    it('should give higher quality scores for better engagement patterns', () => {
      // Arrange
      const lowQualityMetrics: EngagementMetrics = {
        likes: 10,
        shares: 0,
        comments: 0,
        clickThroughRate: 0.01,
        engagementRate: 0.02
      };

      const highQualityMetrics: EngagementMetrics = {
        likes: 100,
        shares: 30,
        comments: 20,
        clickThroughRate: 0.08,
        engagementRate: 0.15
      };

      const content = { metadata: { wordCount: 50 } };

      // Act
      const lowQualityResult = service.calculateDerivedMetrics(lowQualityMetrics, content);
      const highQualityResult = service.calculateDerivedMetrics(highQualityMetrics, content);

      // Assert
      expect(highQualityResult.qualityScore).toBeGreaterThan(lowQualityResult.qualityScore);
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle missing optional metrics', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
        // Missing optional impressions and reach
      };
      const content = { metadata: { wordCount: 100 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.engagementPerImpression).toBe(0);
      expect(result.engagementPerReach).toBe(0);
      expect(result.totalEngagement).toBe(65);
    });

    it('should handle zero word count gracefully', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 50,
        shares: 10,
        comments: 5,
        clickThroughRate: 0.03,
        engagementRate: 0.08
      };
      const content = { metadata: { wordCount: 0 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.engagementPerWord).toBe(0);
      expect(result.totalEngagement).toBe(65);
    });

    it('should handle maximum engagement values', () => {
      // Arrange
      const metrics: EngagementMetrics = {
        likes: 999999,
        shares: 999999,
        comments: 999999,
        clickThroughRate: 1.0,
        engagementRate: 1.0,
        impressions: 10000000,
        reach: 10000000
      };
      const content = { metadata: { wordCount: 1000 } };

      // Act
      const result = service.calculateDerivedMetrics(metrics, content);

      // Assert
      expect(result.totalEngagement).toBe(2999997);
      expect(result.performanceCategory).toBe('exceptional');
      expect(Number.isFinite(result.qualityScore)).toBe(true);
      expect(Number.isFinite(result.engagementScore)).toBe(true);
    });
  });
});
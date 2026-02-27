import fc from 'fast-check';
import { learningIntegrationService, EnhancedContentOptions } from '../src/services/learning-integration';
import { learningProfileService, engagementFeedbackService, generatedContentService } from '../src/services/database';
import { Platform, ContentType, EngagementFeedback, GeneratedContent } from '../src/types';
import { ContentGenerationOptions } from '../src/services/content-generators';

/**
 * Property-based tests for learning integration
 * Feature: contentflow-ai, Property 11: Learning Integration
 * **Validates: Requirements 5.3**
 */

// Mock the database services
jest.mock('../src/services/database');
jest.mock('../src/services/aws-clients');
jest.mock('../src/services/opensearch-service');

const mockLearningProfileService = learningProfileService as jest.Mocked<typeof learningProfileService>;
const mockEngagementFeedbackService = engagementFeedbackService as jest.Mocked<typeof engagementFeedbackService>;
const mockGeneratedContentService = generatedContentService as jest.Mocked<typeof generatedContentService>;

// Arbitraries for generating test data
const platformArbitrary = fc.constantFrom<Platform>(
  'blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'
);

const contentTypeArbitrary = fc.constantFrom<ContentType>(
  'blog-post', 'social-post', 'caption', 'script', 'email', 'ad-copy'
);

const timestampArbitrary = () => 
  fc.integer({ min: new Date('2020-01-01').getTime(), max: Date.now() })
    .map(timestamp => new Date(timestamp).toISOString());

// Helper to create complete GeneratedContent objects
const createMockGeneratedContent = (
  contentId: string,
  userId: string,
  platform: Platform,
  contentType: ContentType,
  timestamp: string
): GeneratedContent => ({
  contentId,
  ideaId: `idea-${contentId}`,
  userId,
  platform,
  contentType,
  generatedText: 'Test generated content',
  metadata: {
    wordCount: 100,
    hashtags: ['#test'],
    seoKeywords: ['test'],
    readingTime: 1
  },
  version: 1,
  status: 'published',
  createdAt: timestamp
});

// Generate historical feedback data with varying performance
const historicalFeedbackArbitrary = (userId: string, platform: Platform, contentType: ContentType, minSamples: number = 5) =>
  fc.array(
    fc.record({
      feedbackId: fc.uuid(),
      contentId: fc.uuid(),
      userId: fc.constant(userId),
      platform: fc.constant(platform),
      metrics: fc.record({
        likes: fc.nat({ max: 1000 }),
        shares: fc.nat({ max: 500 }),
        comments: fc.nat({ max: 200 }),
        clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
        engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
      }),
      timestamp: timestampArbitrary()
    }),
    { minLength: minSamples, maxLength: 50 }
  );

// Generate content generation options
const contentOptionsArbitrary = (userId: string) =>
  fc.record({
    contentIdea: fc.string({ minLength: 10, maxLength: 500 }),
    userId: fc.constant(userId),
    intent: fc.constantFrom('informational', 'promotional', 'educational', 'entertainment')
  });

describe('Property 11: Learning Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: For any content generation request from a user with historical feedback data,
   * the system should incorporate learned preferences into new content
   * **Validates: Requirements 5.3**
   */
  it('should incorporate learned preferences for any user with historical feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        platformArbitrary,
        contentTypeArbitrary,
        fc.nat({ max: 100 }).chain(seed => {
          const userId = `user-${seed}`;
          return fc.tuple(
            fc.constant(userId),
            historicalFeedbackArbitrary(userId, 'twitter', 'social-post', 10),
            contentOptionsArbitrary(userId)
          );
        }),
        async (platform, contentType, [userId, historicalFeedback, contentOptions]) => {
          // Setup: User has historical feedback data
          const mockProfile = {
            profileKey: `${userId}:${platform}:${contentType}`,
            userId,
            platform,
            contentType,
            trainingDataSize: historicalFeedback.length,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.75,
            modelEndpoint: 'test-endpoint',
            platformOptimizations: {
              [platform]: {
                optimalEngagementRate: { min: 0.05, max: 0.15, avg: 0.10 },
                optimalCTR: { min: 0.03, max: 0.08, avg: 0.05 }
              }
            }
          };

          const mockContent = historicalFeedback.map(f => 
            createMockGeneratedContent(f.contentId, userId, platform, contentType, f.timestamp)
          );

          mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfile);
          mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(historicalFeedback);
          mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent);

          // Act: Apply learned preferences
          const result = await learningIntegrationService.applyLearnedPreferences(
            userId,
            contentOptions,
            platform,
            contentType
          );

          // Assert: Learned preferences should be incorporated
          // 1. Result should be enhanced with learning metadata
          expect(result.learningMetadata).toBeDefined();
          expect(result.learningMetadata?.modelUsed).toBe(true);
          
          // 2. Confidence score should be present and valid
          expect(result.learningMetadata?.confidenceScore).toBeGreaterThan(0);
          expect(result.learningMetadata?.confidenceScore).toBeLessThanOrEqual(1);
          
          // 3. Enhanced preferences should be applied
          expect(result.enhancedPreferences).toBeDefined();
          
          // 4. Optimized parameters should be present
          expect(result.optimizedParameters).toBeDefined();
          
          // 5. Application timestamp should be recorded
          expect(result.learningMetadata?.appliedAt).toBeDefined();
          expect(new Date(result.learningMetadata!.appliedAt).getTime()).toBeLessThanOrEqual(Date.now());
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any user without historical feedback, the system should use default preferences
   * **Validates: Requirements 5.3**
   */
  it('should use default preferences for users without historical feedback', async () => {
    await fc.assert(
      fc.asyncProperty(
        platformArbitrary,
        contentTypeArbitrary,
        fc.nat({ max: 100 }).chain(seed => {
          const userId = `user-${seed}`;
          return fc.tuple(
            fc.constant(userId),
            contentOptionsArbitrary(userId)
          );
        }),
        async (platform, contentType, [userId, contentOptions]) => {
          // Setup: User has no historical feedback
          mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
          mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);
          mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue([]);

          // Act: Apply learned preferences
          const result = await learningIntegrationService.applyLearnedPreferences(
            userId,
            contentOptions,
            platform,
            contentType
          );

          // Assert: Default preferences should be used
          // 1. Learning metadata should indicate no model was used
          expect(result.learningMetadata).toBeDefined();
          expect(result.learningMetadata?.modelUsed).toBe(false);
          
          // 2. Confidence score should be 0 (no learning data)
          expect(result.learningMetadata?.confidenceScore).toBe(0);
          
          // 3. Default optimized parameters should be present
          expect(result.optimizedParameters).toBeDefined();
          
          // 4. Enhanced preferences should still be provided (defaults)
          expect(result.enhancedPreferences).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any successful content pattern, the system should identify and store it
   * **Validates: Requirements 5.3**
   */
  it('should identify and store successful patterns from high-performing content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        platformArbitrary,
        contentTypeArbitrary,
        // Generate high-performing feedback
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: platformArbitrary,
          metrics: fc.record({
            likes: fc.integer({ min: 500, max: 10000 }),
            shares: fc.integer({ min: 100, max: 5000 }),
            comments: fc.integer({ min: 50, max: 2000 }),
            clickThroughRate: fc.float({ min: 0.1, max: 1, noNaN: true }),
            engagementRate: fc.float({ min: 0.15, max: 1, noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        async (userId, platform, contentType, highPerformingFeedback) => {
          // Setup: Mock content for the feedback
          const mockContent = createMockGeneratedContent(
            highPerformingFeedback.contentId,
            highPerformingFeedback.userId,
            highPerformingFeedback.platform,
            contentType,
            highPerformingFeedback.timestamp
          );
          mockContent.metadata.hashtags = ['#trending', '#viral'];
          mockContent.metadata.callToAction = 'Learn more';
          mockContent.metadata.wordCount = 150;
          mockContent.metadata.readingTime = 2;

          const mockProfile = {
            profileKey: `${highPerformingFeedback.userId}:${highPerformingFeedback.platform}:${contentType}`,
            userId: highPerformingFeedback.userId,
            platform: highPerformingFeedback.platform,
            contentType,
            trainingDataSize: 15,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.7
          };

          mockGeneratedContentService.getGeneratedContent.mockResolvedValue(mockContent);
          mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfile);
          mockLearningProfileService.updateLearningProfile.mockResolvedValue(undefined);

          // Act: Update learning profiles with high-performing feedback
          await learningIntegrationService.updateLearningProfiles(highPerformingFeedback);

          // Assert: System should update the learning profile
          // 1. Profile should be retrieved
          expect(mockLearningProfileService.getLearningProfile).toHaveBeenCalled();
          
          // 2. Profile should be updated with new insights
          expect(mockLearningProfileService.updateLearningProfile).toHaveBeenCalled();
          
          // 3. Update should include new training data size
          const updateCall = mockLearningProfileService.updateLearningProfile.mock.calls[0];
          expect(updateCall[1]).toHaveProperty('trainingDataSize');
          expect(updateCall[1].trainingDataSize).toBeGreaterThan(mockProfile.trainingDataSize);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any platform-content type combination, learned preferences should be specific
   * **Validates: Requirements 5.3**
   */
  it('should maintain separate learned preferences for different platform-content type combinations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        platformArbitrary,
        platformArbitrary,
        contentTypeArbitrary,
        contentTypeArbitrary,
        async (userId, platform1, platform2, contentType1, contentType2) => {
          // Skip if both combinations are identical
          if (platform1 === platform2 && contentType1 === contentType2) {
            return;
          }

          // Setup: Create profiles for different combinations
          const profile1 = {
            profileKey: `${userId}:${platform1}:${contentType1}`,
            userId,
            platform: platform1,
            contentType: contentType1,
            trainingDataSize: 20,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.8,
            modelEndpoint: 'endpoint-1',
            platformOptimizations: {
              [platform1]: { temperature: 0.7, includeHashtags: true }
            }
          };

          const profile2 = {
            profileKey: `${userId}:${platform2}:${contentType2}`,
            userId,
            platform: platform2,
            contentType: contentType2,
            trainingDataSize: 15,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.6,
            modelEndpoint: 'endpoint-2',
            platformOptimizations: {
              [platform2]: { temperature: 0.5, includeHashtags: false }
            }
          };

          const contentOptions = {
            contentIdea: 'Test content idea',
            userId,
            intent: 'promotional' as const
          };

          // Act: Apply learned preferences for both combinations
          mockLearningProfileService.getLearningProfile
            .mockResolvedValueOnce(profile1)
            .mockResolvedValueOnce(profile2);

          const result1 = await learningIntegrationService.applyLearnedPreferences(
            userId,
            contentOptions,
            platform1,
            contentType1
          );

          const result2 = await learningIntegrationService.applyLearnedPreferences(
            userId,
            contentOptions,
            platform2,
            contentType2
          );

          // Assert: Preferences should be specific to each combination
          // 1. Both should use learned models
          expect(result1.learningMetadata?.modelUsed).toBe(true);
          expect(result2.learningMetadata?.modelUsed).toBe(true);
          
          // 2. Confidence scores should reflect their respective profiles
          expect(result1.learningMetadata?.confidenceScore).toBeGreaterThan(0);
          expect(result2.learningMetadata?.confidenceScore).toBeGreaterThan(0);
          
          // 3. Both should have optimized parameters
          expect(result1.optimizedParameters).toBeDefined();
          expect(result2.optimizedParameters).toBeDefined();
          
          // 4. Profile lookups should use correct keys
          expect(mockLearningProfileService.getLearningProfile).toHaveBeenCalledWith(
            `${userId}:${platform1}:${contentType1}`
          );
          expect(mockLearningProfileService.getLearningProfile).toHaveBeenCalledWith(
            `${userId}:${platform2}:${contentType2}`
          );
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: For any user with sufficient feedback data, learning profile should be created
   * **Validates: Requirements 5.3**
   */
  it('should create learning profile when sufficient feedback data is available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 100 }).chain(seed => {
          const userId = `user-${seed}`;
          return fc.tuple(
            fc.constant(userId),
            platformArbitrary,
            contentTypeArbitrary,
            historicalFeedbackArbitrary(userId, 'twitter', 'social-post', 5)
          );
        }),
        async ([userId, platform, contentType, historicalFeedback]) => {
          // Setup: User has no existing profile but has sufficient feedback
          const mockContent = historicalFeedback.map(f => 
            createMockGeneratedContent(f.contentId, userId, platform, contentType, f.timestamp)
          );

          mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
          mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(historicalFeedback);
          mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent);
          mockLearningProfileService.createLearningProfile.mockResolvedValue(undefined);

          // Act: Get learning profile (should create new one)
          const result = await learningIntegrationService.getLearningProfile(
            userId,
            platform,
            contentType
          );

          // Assert: Profile should be created
          // 1. Profile should be returned
          expect(result).toBeDefined();
          
          // 2. Profile should have correct identifiers
          expect(result?.userId).toBe(userId);
          expect(result?.platform).toBe(platform);
          expect(result?.contentType).toBe(contentType);
          
          // 3. Training data size should match feedback count
          expect(result?.trainingDataSize).toBe(historicalFeedback.length);
          
          // 4. Confidence score should be calculated
          expect(result?.confidenceScore).toBeGreaterThan(0);
          expect(result?.confidenceScore).toBeLessThanOrEqual(1);
          
          // 5. Profile should be stored
          expect(mockLearningProfileService.createLearningProfile).toHaveBeenCalled();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any incremental feedback, confidence score should be updated appropriately
   * **Validates: Requirements 5.3**
   */
  it('should update confidence score with each new feedback data point', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        platformArbitrary,
        contentTypeArbitrary,
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          userId: fc.uuid(),
          platform: platformArbitrary,
          metrics: fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.nat({ max: 500 }),
            comments: fc.nat({ max: 200 }),
            clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
            engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        fc.float({ min: 0.3, max: 0.9, noNaN: true }), // Initial confidence score
        async (userId, platform, contentType, newFeedback, initialConfidence) => {
          // Setup: Existing profile with initial confidence
          const mockProfile = {
            profileKey: `${newFeedback.userId}:${newFeedback.platform}:${contentType}`,
            userId: newFeedback.userId,
            platform: newFeedback.platform,
            contentType,
            trainingDataSize: 20,
            lastUpdated: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            modelVersion: 'v1',
            confidenceScore: initialConfidence
          };

          const mockContent = createMockGeneratedContent(
            newFeedback.contentId,
            newFeedback.userId,
            newFeedback.platform,
            contentType,
            newFeedback.timestamp
          );

          mockGeneratedContentService.getGeneratedContent.mockResolvedValue(mockContent);
          mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfile);
          mockLearningProfileService.updateLearningProfile.mockResolvedValue(undefined);

          // Act: Update with new feedback
          await learningIntegrationService.updateLearningProfiles(newFeedback);

          // Assert: Confidence score should be updated
          // 1. Profile should be updated
          expect(mockLearningProfileService.updateLearningProfile).toHaveBeenCalled();
          
          // 2. Update should include new confidence score
          const updateCall = mockLearningProfileService.updateLearningProfile.mock.calls[0];
          expect(updateCall[1]).toHaveProperty('confidenceScore');
          
          // 3. New confidence score should be valid
          const newConfidence = updateCall[1].confidenceScore;
          expect(newConfidence).toBeGreaterThanOrEqual(0);
          expect(newConfidence).toBeLessThanOrEqual(1);
          
          // 4. Training data size should increase
          expect(updateCall[1].trainingDataSize).toBe(mockProfile.trainingDataSize + 1);
          
          // 5. Last updated timestamp should be recent
          expect(updateCall[1].lastUpdated).toBeDefined();
          expect(new Date(updateCall[1].lastUpdated).getTime()).toBeGreaterThan(
            new Date(mockProfile.lastUpdated).getTime()
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any user with learning profile, insights should be generated
   * **Validates: Requirements 5.3**
   */
  it('should generate learning insights for any user with learning profiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.tuple(platformArbitrary, contentTypeArbitrary),
          { minLength: 1, maxLength: 5 }
        ),
        async (userId, platformContentPairs) => {
          // Setup: Create multiple learning profiles for the user
          const mockProfiles = platformContentPairs.map(([platform, contentType]) => ({
            profileKey: `${userId}:${platform}:${contentType}`,
            userId,
            platform,
            contentType,
            trainingDataSize: Math.floor(Math.random() * 50) + 10,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: Math.random() * 0.5 + 0.4, // 0.4 to 0.9
            modelMetrics: {
              accuracy: Math.random() * 0.3 + 0.7 // 0.7 to 1.0
            }
          }));

          mockLearningProfileService.getUserLearningProfiles.mockResolvedValue(mockProfiles);
          mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);

          // Act: Get learning insights
          const result = await learningIntegrationService.getLearningInsights(userId);

          // Assert: Insights should be comprehensive
          // 1. Insights should be generated
          expect(result).toBeDefined();
          expect(result.userId).toBe(userId);
          
          // 2. Profile summary should include all profiles
          expect(Object.keys(result.profileSummary)).toHaveLength(mockProfiles.length);
          
          // 3. Each profile should have summary information
          mockProfiles.forEach(profile => {
            expect(result.profileSummary[profile.profileKey]).toBeDefined();
            expect(result.profileSummary[profile.profileKey].platform).toBe(profile.platform);
            expect(result.profileSummary[profile.profileKey].contentType).toBe(profile.contentType);
            expect(result.profileSummary[profile.profileKey].confidenceScore).toBe(profile.confidenceScore);
          });
          
          // 4. Performance improvements should be tracked
          expect(result.performanceImprovements).toBeDefined();
          
          // 5. Recommendations should be provided
          expect(result.recommendations).toBeDefined();
          expect(Array.isArray(result.recommendations)).toBe(true);
          expect(result.recommendations.length).toBeGreaterThan(0);
          
          // 6. Model metrics should be included
          expect(result.modelMetrics).toBeDefined();
          
          // 7. Generation timestamp should be present
          expect(result.generatedAt).toBeDefined();
          expect(new Date(result.generatedAt).getTime()).toBeLessThanOrEqual(Date.now());
        }
      ),
      { numRuns: 30 }
    );
  });
});

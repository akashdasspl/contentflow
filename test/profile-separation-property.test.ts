import fc from 'fast-check';
import { learningIntegrationService } from '../src/services/learning-integration';
import { learningProfileService, engagementFeedbackService, generatedContentService } from '../src/services/database';
import { Platform, ContentType, EngagementFeedback, GeneratedContent } from '../src/types';

/**
 * Property-based tests for profile separation
 * Feature: contentflow-ai, Property 12: Profile Separation
 * **Validates: Requirements 5.4**
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

// Generate historical feedback data for specific platform and content type
const historicalFeedbackArbitrary = (
  userId: string, 
  platform: Platform, 
  contentType: ContentType, 
  minSamples: number = 5
) =>
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

describe('Property 12: Profile Separation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property: For any user generating content across different platforms and content types,
   * the system should maintain separate learning profiles for each combination
   * **Validates: Requirements 5.4**
   */
  it('should maintain separate profiles for each platform-content type combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.tuple(platformArbitrary, contentTypeArbitrary),
          { minLength: 2, maxLength: 5 }
        ),
        async (userId, platformContentPairs) => {
          // Ensure we have at least 2 unique combinations
          const uniquePairs = Array.from(
            new Set(platformContentPairs.map(([p, c]) => `${p}:${c}`))
          ).map(key => {
            const [platform, contentType] = key.split(':');
            return [platform as Platform, contentType as ContentType] as const;
          });

          if (uniquePairs.length < 2) {
            return; // Skip if not enough unique combinations
          }

          // Create separate profiles for each combination
          const profiles = uniquePairs.map(([platform, contentType]) => ({
            profileKey: `${userId}:${platform}:${contentType}`,
            userId,
            platform,
            contentType,
            trainingDataSize: Math.floor(Math.random() * 30) + 10,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: Math.random() * 0.5 + 0.4, // 0.4 to 0.9
            platformOptimizations: {
              [platform]: {
                temperature: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
                includeHashtags: Math.random() > 0.5,
              }
            }
          }));

          // Mock the service to return all profiles
          mockLearningProfileService.getUserLearningProfiles.mockResolvedValue(profiles);

          // Act: Get all profiles for the user
          const retrievedProfiles = await learningIntegrationService.getLearningInsights(userId);

          // Assert: Each combination should have its own profile
          // 1. Number of profiles should match number of unique combinations
          expect(Object.keys(retrievedProfiles.profileSummary)).toHaveLength(uniquePairs.length);

          // 2. Each profile should have a unique key
          const profileKeys = Object.keys(retrievedProfiles.profileSummary);
          const uniqueKeys = new Set(profileKeys);
          expect(uniqueKeys.size).toBe(profileKeys.length);

          // 3. Each profile key should follow the format userId:platform:contentType
          profileKeys.forEach(key => {
            expect(key).toMatch(/^[^:]+:[^:]+:[^:]+$/);
            const [keyUserId, platform, contentType] = key.split(':');
            expect(keyUserId).toBe(userId);
            expect(['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok']).toContain(platform);
            expect(['blog-post', 'social-post', 'caption', 'script', 'email', 'ad-copy']).toContain(contentType);
          });

          // 4. Each profile should have platform and content type specific data
          uniquePairs.forEach(([platform, contentType]) => {
            const profileKey = `${userId}:${platform}:${contentType}`;
            const profile = retrievedProfiles.profileSummary[profileKey];
            expect(profile).toBeDefined();
            expect(profile.platform).toBe(platform);
            expect(profile.contentType).toBe(contentType);
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: For any two different platform-content type combinations,
   * their learning profiles should be independent and not affect each other
   * **Validates: Requirements 5.4**
   */
  it('should keep profiles independent across different combinations', async () => {
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

          const profileKey1 = `${userId}:${platform1}:${contentType1}`;
          const profileKey2 = `${userId}:${platform2}:${contentType2}`;

          // Create distinct profiles with different characteristics
          const profile1 = {
            profileKey: profileKey1,
            userId,
            platform: platform1,
            contentType: contentType1,
            trainingDataSize: 25,
            lastUpdated: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
            modelVersion: 'v1',
            confidenceScore: 0.75,
            platformOptimizations: {
              [platform1]: {
                temperature: 0.7,
                includeHashtags: true,
                optimalEngagementRate: { min: 0.05, max: 0.15, avg: 0.10 }
              }
            }
          };

          const profile2 = {
            profileKey: profileKey2,
            userId,
            platform: platform2,
            contentType: contentType2,
            trainingDataSize: 15,
            lastUpdated: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            modelVersion: 'v1',
            confidenceScore: 0.55,
            platformOptimizations: {
              [platform2]: {
                temperature: 0.5,
                includeHashtags: false,
                optimalEngagementRate: { min: 0.03, max: 0.10, avg: 0.06 }
              }
            }
          };

          // Mock profile retrieval
          mockLearningProfileService.getLearningProfile
            .mockImplementation(async (key: string) => {
              if (key === profileKey1) return profile1;
              if (key === profileKey2) return profile2;
              return null;
            });

          // Act: Get both profiles
          const retrievedProfile1 = await learningIntegrationService.getLearningProfile(
            userId,
            platform1,
            contentType1
          );

          const retrievedProfile2 = await learningIntegrationService.getLearningProfile(
            userId,
            platform2,
            contentType2
          );

          // Assert: Profiles should be independent
          // 1. Both profiles should exist
          expect(retrievedProfile1).toBeDefined();
          expect(retrievedProfile2).toBeDefined();

          // 2. Profile keys should be different
          expect(retrievedProfile1!.profileKey).not.toBe(retrievedProfile2!.profileKey);

          // 3. Training data sizes should be independent
          expect(retrievedProfile1!.trainingDataSize).toBe(25);
          expect(retrievedProfile2!.trainingDataSize).toBe(15);

          // 4. Confidence scores should be independent
          expect(retrievedProfile1!.confidenceScore).toBe(0.75);
          expect(retrievedProfile2!.confidenceScore).toBe(0.55);

          // 5. Platform optimizations should be specific to each profile
          expect(retrievedProfile1!.platformOptimizations?.[platform1]).toBeDefined();
          expect(retrievedProfile2!.platformOptimizations?.[platform2]).toBeDefined();

          // 6. Last updated timestamps should be independent
          expect(retrievedProfile1!.lastUpdated).not.toBe(retrievedProfile2!.lastUpdated);
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Property: For any feedback on a specific platform-content type combination,
   * only the corresponding profile should be updated
   * **Validates: Requirements 5.4**
   */
  it('should update only the corresponding profile when feedback is received', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        platformArbitrary,
        contentTypeArbitrary,
        fc.record({
          feedbackId: fc.uuid(),
          contentId: fc.uuid(),
          metrics: fc.record({
            likes: fc.nat({ max: 1000 }),
            shares: fc.nat({ max: 500 }),
            comments: fc.nat({ max: 200 }),
            clickThroughRate: fc.float({ min: 0, max: 1, noNaN: true }),
            engagementRate: fc.float({ min: 0, max: 1, noNaN: true })
          }),
          timestamp: timestampArbitrary()
        }),
        async (userId, targetPlatform, targetContentType, feedbackData) => {
          // Create feedback for specific platform
          const feedback: EngagementFeedback = {
            ...feedbackData,
            userId,
            platform: targetPlatform,
          };

          // Create content for the feedback
          const content = createMockGeneratedContent(
            feedback.contentId,
            userId,
            targetPlatform,
            targetContentType,
            feedback.timestamp
          );

          // Create multiple profiles for different combinations
          const targetProfileKey = `${userId}:${targetPlatform}:${targetContentType}`;
          const otherProfileKey = `${userId}:twitter:social-post`; // Different combination

          const targetProfile = {
            profileKey: targetProfileKey,
            userId,
            platform: targetPlatform,
            contentType: targetContentType,
            trainingDataSize: 20,
            lastUpdated: new Date(Date.now() - 86400000).toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.7
          };

          const otherProfile = {
            profileKey: otherProfileKey,
            userId,
            platform: 'twitter' as Platform,
            contentType: 'social-post' as ContentType,
            trainingDataSize: 15,
            lastUpdated: new Date(Date.now() - 86400000).toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.6
          };

          // Mock services
          mockGeneratedContentService.getGeneratedContent.mockResolvedValue(content);
          mockLearningProfileService.getLearningProfile
            .mockImplementation(async (key: string) => {
              if (key === targetProfileKey) return targetProfile;
              if (key === otherProfileKey) return otherProfile;
              return null;
            });
          mockLearningProfileService.updateLearningProfile.mockResolvedValue(undefined);

          // Act: Update profiles with feedback
          await learningIntegrationService.updateLearningProfiles(feedback);

          // Assert: Only the target profile should be updated
          // 1. Update should be called
          expect(mockLearningProfileService.updateLearningProfile).toHaveBeenCalled();

          // 2. Update should be for the correct profile key
          const updateCalls = mockLearningProfileService.updateLearningProfile.mock.calls;
          const updatedKeys = updateCalls.map(call => call[0]);
          expect(updatedKeys).toContain(targetProfileKey);

          // 3. The other profile should not be updated
          if (targetProfileKey !== otherProfileKey) {
            expect(updatedKeys).not.toContain(otherProfileKey);
          }

          // 4. Training data size should be incremented for target profile
          const targetUpdate = updateCalls.find(call => call[0] === targetProfileKey);
          if (targetUpdate) {
            expect(targetUpdate[1].trainingDataSize).toBe(targetProfile.trainingDataSize + 1);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: For any user with content on multiple platforms,
   * each platform should have its own learning profile with platform-specific optimizations
   * **Validates: Requirements 5.4**
   */
  it('should maintain platform-specific optimizations in separate profiles', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(platformArbitrary, { minLength: 2, maxLength: 4 }),
        contentTypeArbitrary,
        async (userId, platforms, contentType) => {
          // Ensure unique platforms
          const uniquePlatforms = Array.from(new Set(platforms));
          if (uniquePlatforms.length < 2) {
            return; // Skip if not enough unique platforms
          }

          // Create profiles with platform-specific optimizations
          const profiles = uniquePlatforms.map(platform => ({
            profileKey: `${userId}:${platform}:${contentType}`,
            userId,
            platform,
            contentType,
            trainingDataSize: Math.floor(Math.random() * 30) + 10,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: Math.random() * 0.5 + 0.4,
            platformOptimizations: {
              [platform]: {
                temperature: Math.random() * 0.5 + 0.5,
                includeHashtags: platform !== 'blog',
                optimalLength: platform === 'twitter' ? 140 : platform === 'blog' ? 1200 : 250,
                bestPostingTime: `${Math.floor(Math.random() * 24)}:00`
              }
            }
          }));

          // Mock profile retrieval
          mockLearningProfileService.getLearningProfile
            .mockImplementation(async (key: string) => {
              return profiles.find(p => p.profileKey === key) || null;
            });

          // Act: Get profiles for each platform
          const retrievedProfiles = await Promise.all(
            uniquePlatforms.map(platform =>
              learningIntegrationService.getLearningProfile(userId, platform, contentType)
            )
          );

          // Assert: Each platform should have its own optimizations
          // 1. All profiles should be retrieved
          expect(retrievedProfiles.every(p => p !== null)).toBe(true);

          // 2. Each profile should have platform-specific optimizations
          retrievedProfiles.forEach((profile, index) => {
            const platform = uniquePlatforms[index];
            expect(profile!.platform).toBe(platform);
            expect(profile!.platformOptimizations?.[platform]).toBeDefined();
          });

          // 3. Optimizations should differ between platforms
          for (let i = 0; i < retrievedProfiles.length - 1; i++) {
            for (let j = i + 1; j < retrievedProfiles.length; j++) {
              const profile1 = retrievedProfiles[i]!;
              const profile2 = retrievedProfiles[j]!;
              
              // Profile keys should be different
              expect(profile1.profileKey).not.toBe(profile2.profileKey);
              
              // Platforms should be different
              expect(profile1.platform).not.toBe(profile2.platform);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: For any user with content of multiple types on the same platform,
   * each content type should have its own learning profile
   * **Validates: Requirements 5.4**
   */
  it('should maintain content-type-specific profiles on the same platform', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        platformArbitrary,
        fc.array(contentTypeArbitrary, { minLength: 2, maxLength: 4 }),
        async (userId, platform, contentTypes) => {
          // Ensure unique content types
          const uniqueContentTypes = Array.from(new Set(contentTypes));
          if (uniqueContentTypes.length < 2) {
            return; // Skip if not enough unique content types
          }

          // Create profiles with content-type-specific characteristics
          const profiles = uniqueContentTypes.map(contentType => ({
            profileKey: `${userId}:${platform}:${contentType}`,
            userId,
            platform,
            contentType,
            trainingDataSize: Math.floor(Math.random() * 30) + 10,
            lastUpdated: new Date().toISOString(),
            modelVersion: 'v1',
            confidenceScore: Math.random() * 0.5 + 0.4,
            platformOptimizations: {
              [platform]: {
                temperature: Math.random() * 0.5 + 0.5,
                optimalLength: contentType === 'blog-post' ? 1200 : 
                              contentType === 'caption' ? 100 : 250,
                includeHashtags: contentType !== 'blog-post'
              }
            }
          }));

          // Mock profile retrieval
          mockLearningProfileService.getLearningProfile
            .mockImplementation(async (key: string) => {
              return profiles.find(p => p.profileKey === key) || null;
            });

          // Act: Get profiles for each content type
          const retrievedProfiles = await Promise.all(
            uniqueContentTypes.map(contentType =>
              learningIntegrationService.getLearningProfile(userId, platform, contentType)
            )
          );

          // Assert: Each content type should have its own profile
          // 1. All profiles should be retrieved
          expect(retrievedProfiles.every(p => p !== null)).toBe(true);

          // 2. Each profile should be for the same platform but different content type
          retrievedProfiles.forEach((profile, index) => {
            const contentType = uniqueContentTypes[index];
            expect(profile!.platform).toBe(platform);
            expect(profile!.contentType).toBe(contentType);
          });

          // 3. Profile keys should be unique
          const profileKeys = retrievedProfiles.map(p => p!.profileKey);
          const uniqueKeys = new Set(profileKeys);
          expect(uniqueKeys.size).toBe(profileKeys.length);

          // 4. Profiles should have different characteristics
          for (let i = 0; i < retrievedProfiles.length - 1; i++) {
            for (let j = i + 1; j < retrievedProfiles.length; j++) {
              const profile1 = retrievedProfiles[i]!;
              const profile2 = retrievedProfiles[j]!;
              
              // Content types should be different
              expect(profile1.contentType).not.toBe(profile2.contentType);
              
              // Profile keys should be different
              expect(profile1.profileKey).not.toBe(profile2.profileKey);
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: For any profile creation with sufficient feedback data,
   * the profile should be specific to the platform-content type combination
   * **Validates: Requirements 5.4**
   */
  it('should create profiles specific to platform-content type combinations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 100 }).chain(seed => {
          const userId = `user-${seed}`;
          return fc.tuple(
            fc.constant(userId),
            platformArbitrary,
            contentTypeArbitrary
          );
        }),
        async ([userId, platform, contentType]) => {
          // Clear mocks for this test iteration
          jest.clearAllMocks();

          // Generate feedback data for this specific combination
          const feedback = await fc.sample(
            historicalFeedbackArbitrary(userId, platform, contentType, 10),
            1
          )[0];

          const mockContent = feedback.map(f => 
            createMockGeneratedContent(f.contentId, userId, platform, contentType, f.timestamp)
          );

          // Mock services
          mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
          mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(feedback);
          mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent);
          mockLearningProfileService.createLearningProfile.mockResolvedValue(undefined);

          // Act: Get or create learning profile
          const profile = await learningIntegrationService.getLearningProfile(
            userId,
            platform,
            contentType
          );

          // Assert: Profile should be specific to the combination
          // 1. Profile should be created
          expect(profile).toBeDefined();

          // 2. Profile should have correct identifiers
          expect(profile!.userId).toBe(userId);
          expect(profile!.platform).toBe(platform);
          expect(profile!.contentType).toBe(contentType);

          // 3. Profile key should follow the format
          expect(profile!.profileKey).toBe(`${userId}:${platform}:${contentType}`);

          // 4. Training data should match the feedback count
          expect(profile!.trainingDataSize).toBe(feedback.length);

          // 5. Profile should be stored with the correct key
          expect(mockLearningProfileService.createLearningProfile).toHaveBeenCalled();
          const createCalls = mockLearningProfileService.createLearningProfile.mock.calls;
          // Find the call for this specific profile
          const relevantCall = createCalls.find(call => 
            call[0].userId === userId && 
            call[0].platform === platform && 
            call[0].contentType === contentType
          );
          expect(relevantCall).toBeDefined();
          expect(relevantCall![0].profileKey).toBe(`${userId}:${platform}:${contentType}`);
        }
      ),
      { numRuns: 40 }
    );
  });

  /**
   * Property: For any user with multiple profiles, insights should show separation
   * **Validates: Requirements 5.4**
   */
  it('should show profile separation in learning insights', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.array(
          fc.tuple(platformArbitrary, contentTypeArbitrary),
          { minLength: 3, maxLength: 6 }
        ),
        async (userId, platformContentPairs) => {
          // Ensure unique combinations
          const uniquePairs = Array.from(
            new Set(platformContentPairs.map(([p, c]) => `${p}:${c}`))
          ).map(key => {
            const [platform, contentType] = key.split(':');
            return [platform as Platform, contentType as ContentType] as const;
          });

          if (uniquePairs.length < 3) {
            return; // Skip if not enough unique combinations
          }

          // Create profiles with varying characteristics
          const profiles = uniquePairs.map(([platform, contentType], index) => ({
            profileKey: `${userId}:${platform}:${contentType}`,
            userId,
            platform,
            contentType,
            trainingDataSize: 10 + index * 5,
            lastUpdated: new Date(Date.now() - index * 86400000).toISOString(),
            modelVersion: 'v1',
            confidenceScore: 0.5 + (index * 0.1),
            modelMetrics: {
              accuracy: 0.7 + (index * 0.05)
            }
          }));

          // Mock services
          mockLearningProfileService.getUserLearningProfiles.mockResolvedValue(profiles);
          mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);

          // Act: Get learning insights
          const insights = await learningIntegrationService.getLearningInsights(userId);

          // Assert: Insights should show profile separation
          // 1. Should have summary for each profile
          expect(Object.keys(insights.profileSummary)).toHaveLength(uniquePairs.length);

          // 2. Each profile summary should have unique platform-content type combination
          const combinations = new Set<string>();
          Object.values(insights.profileSummary).forEach(summary => {
            const combo = `${summary.platform}:${summary.contentType}`;
            combinations.add(combo);
          });
          expect(combinations.size).toBe(uniquePairs.length);

          // 3. Each profile should have independent metrics
          const summaries = Object.values(insights.profileSummary);
          for (let i = 0; i < summaries.length - 1; i++) {
            for (let j = i + 1; j < summaries.length; j++) {
              const summary1 = summaries[i];
              const summary2 = summaries[j];
              
              // Either platform or content type should be different
              const isDifferent = 
                summary1.platform !== summary2.platform ||
                summary1.contentType !== summary2.contentType;
              expect(isDifferent).toBe(true);
            }
          }

          // 4. Performance improvements should be tracked separately
          expect(Object.keys(insights.performanceImprovements)).toHaveLength(uniquePairs.length);

          // 5. Each profile key in insights should match the format
          Object.keys(insights.profileSummary).forEach(key => {
            expect(key).toMatch(/^[^:]+:[^:]+:[^:]+$/);
          });
        }
      ),
      { numRuns: 25 }
    );
  });
});

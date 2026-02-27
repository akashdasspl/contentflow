// Unit tests for Learning Integration Service

import { learningIntegrationService } from '../src/services/learning-integration';
import { learningProfileService, engagementFeedbackService, generatedContentService } from '../src/services/database';
import { Platform, ContentType, EngagementFeedback } from '../src/types';

// Mock the database services
jest.mock('../src/services/database');
jest.mock('../src/services/aws-clients');
jest.mock('../src/services/opensearch-service');

const mockLearningProfileService = learningProfileService as jest.Mocked<typeof learningProfileService>;
const mockEngagementFeedbackService = engagementFeedbackService as jest.Mocked<typeof engagementFeedbackService>;
const mockGeneratedContentService = generatedContentService as jest.Mocked<typeof generatedContentService>;

describe('LearningIntegrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLearningProfile', () => {
    it('should return existing learning profile', async () => {
      const userId = 'user123';
      const platform: Platform = 'twitter';
      const contentType: ContentType = 'social-post';
      
      const mockProfile = {
        profileKey: `${userId}:${platform}:${contentType}`,
        userId,
        platform,
        contentType,
        trainingDataSize: 25,
        lastUpdated: '2024-01-01T00:00:00Z',
        modelVersion: 'v1',
        confidenceScore: 0.8,
      };

      mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfile);

      const result = await learningIntegrationService.getLearningProfile(userId, platform, contentType);

      expect(result).toEqual(mockProfile);
      expect(mockLearningProfileService.getLearningProfile).toHaveBeenCalledWith(`${userId}:${platform}:${contentType}`);
    });

    it('should create new profile when sufficient feedback data exists', async () => {
      const userId = 'user123';
      const platform: Platform = 'twitter';
      const contentType: ContentType = 'social-post';
      
      // Mock no existing profile
      mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
      
      // Mock sufficient feedback data
      const mockFeedback: EngagementFeedback[] = Array.from({ length: 10 }, (_, i) => ({
        feedbackId: `feedback${i}`,
        contentId: `content${i}`,
        userId,
        platform,
        metrics: {
          likes: 10 + i,
          shares: 2 + i,
          comments: 1 + i,
          clickThroughRate: 0.05 + (i * 0.01),
          engagementRate: 0.08 + (i * 0.01),
        },
        timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      }));

      const mockContent = Array.from({ length: 10 }, (_, i) => ({
        contentId: `content${i}`,
        contentType,
        platform,
        userId,
      }));

      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedback);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent);
      mockLearningProfileService.createLearningProfile.mockResolvedValue(undefined);

      const result = await learningIntegrationService.getLearningProfile(userId, platform, contentType);

      expect(result).toBeDefined();
      expect(result?.userId).toBe(userId);
      expect(result?.platform).toBe(platform);
      expect(result?.contentType).toBe(contentType);
      expect(result?.trainingDataSize).toBe(10);
      expect(mockLearningProfileService.createLearningProfile).toHaveBeenCalled();
    });

    it('should return null when insufficient feedback data', async () => {
      const userId = 'user123';
      const platform: Platform = 'twitter';
      const contentType: ContentType = 'social-post';
      
      // Mock no existing profile
      mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
      
      // Mock insufficient feedback data (less than 5)
      const mockFeedback: EngagementFeedback[] = Array.from({ length: 3 }, (_, i) => ({
        feedbackId: `feedback${i}`,
        contentId: `content${i}`,
        userId,
        platform,
        metrics: {
          likes: 10,
          shares: 2,
          comments: 1,
          clickThroughRate: 0.05,
          engagementRate: 0.08,
        },
        timestamp: new Date().toISOString(),
      }));

      const mockContent = Array.from({ length: 3 }, (_, i) => ({
        contentId: `content${i}`,
        contentType,
        platform,
        userId,
      }));

      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedback);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent);

      const result = await learningIntegrationService.getLearningProfile(userId, platform, contentType);

      expect(result).toBeNull();
      expect(mockLearningProfileService.createLearningProfile).not.toHaveBeenCalled();
    });
  });

  describe('applyLearnedPreferences', () => {
    it('should apply learned preferences when profile exists', async () => {
      const userId = 'user123';
      const platform: Platform = 'twitter';
      const contentType: ContentType = 'social-post';
      
      const mockProfile = {
        profileKey: `${userId}:${platform}:${contentType}`,
        userId,
        platform,
        contentType,
        trainingDataSize: 25,
        lastUpdated: '2024-01-01T00:00:00Z',
        modelVersion: 'v1',
        confidenceScore: 0.8,
        modelEndpoint: 'test-endpoint',
        platformOptimizations: {
          [platform]: {
            optimalEngagementRate: { min: 0.08, max: 0.15, avg: 0.12 },
            optimalCTR: { min: 0.04, max: 0.08, avg: 0.06 },
          },
        },
      };

      const contentOptions = {
        contentIdea: 'Test content idea',
        userId,
        intent: 'promotional' as const,
      };

      mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfile);

      const result = await learningIntegrationService.applyLearnedPreferences(
        userId,
        contentOptions,
        platform,
        contentType
      );

      expect(result).toBeDefined();
      expect(result.learningMetadata?.modelUsed).toBe(true);
      expect(result.learningMetadata?.confidenceScore).toBeGreaterThan(0);
      expect(result.enhancedPreferences).toBeDefined();
    });

    it('should use default preferences when no profile exists', async () => {
      const userId = 'user123';
      const platform: Platform = 'twitter';
      const contentType: ContentType = 'social-post';
      
      const contentOptions = {
        contentIdea: 'Test content idea',
        userId,
        intent: 'promotional' as const,
      };

      mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue([]);

      const result = await learningIntegrationService.applyLearnedPreferences(
        userId,
        contentOptions,
        platform,
        contentType
      );

      expect(result).toBeDefined();
      expect(result.learningMetadata?.modelUsed).toBe(false);
      expect(result.learningMetadata?.confidenceScore).toBe(0);
      expect(result.optimizedParameters).toBeDefined();
    });
  });

  describe('updateLearningProfiles', () => {
    it('should update existing learning profile with new feedback', async () => {
      const feedback: EngagementFeedback = {
        feedbackId: 'feedback123',
        contentId: 'content123',
        userId: 'user123',
        platform: 'twitter',
        metrics: {
          likes: 15,
          shares: 3,
          comments: 2,
          clickThroughRate: 0.06,
          engagementRate: 0.12,
        },
        timestamp: new Date().toISOString(),
      };

      const mockContent = {
        contentId: 'content123',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        userId: 'user123',
      };

      const mockProfile = {
        profileKey: 'user123:twitter:social-post',
        userId: 'user123',
        platform: 'twitter' as Platform,
        contentType: 'social-post' as ContentType,
        trainingDataSize: 25,
        lastUpdated: '2024-01-01T00:00:00Z',
        modelVersion: 'v1',
        confidenceScore: 0.8,
      };

      mockGeneratedContentService.getGeneratedContent.mockResolvedValue(mockContent);
      mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfile);
      mockLearningProfileService.updateLearningProfile.mockResolvedValue(undefined);

      await learningIntegrationService.updateLearningProfiles(feedback);

      expect(mockGeneratedContentService.getGeneratedContent).toHaveBeenCalledWith('content123');
      expect(mockLearningProfileService.getLearningProfile).toHaveBeenCalledWith('user123:twitter:social-post');
      expect(mockLearningProfileService.updateLearningProfile).toHaveBeenCalled();
    });

    it('should create new profile when sufficient feedback data exists', async () => {
      const feedback: EngagementFeedback = {
        feedbackId: 'feedback123',
        contentId: 'content123',
        userId: 'user123',
        platform: 'twitter',
        metrics: {
          likes: 15,
          shares: 3,
          comments: 2,
          clickThroughRate: 0.06,
          engagementRate: 0.12,
        },
        timestamp: new Date().toISOString(),
      };

      const mockContent = {
        contentId: 'content123',
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        userId: 'user123',
      };

      // Mock sufficient feedback data for new profile creation
      const mockAllFeedback: EngagementFeedback[] = Array.from({ length: 10 }, (_, i) => ({
        feedbackId: `feedback${i}`,
        contentId: `content${i}`,
        userId: 'user123',
        platform: 'twitter',
        metrics: {
          likes: 10 + i,
          shares: 2 + i,
          comments: 1 + i,
          clickThroughRate: 0.05 + (i * 0.01),
          engagementRate: 0.08 + (i * 0.01),
        },
        timestamp: new Date().toISOString(),
      }));

      const mockAllContent = Array.from({ length: 10 }, (_, i) => ({
        contentId: `content${i}`,
        contentType: 'social-post' as ContentType,
        platform: 'twitter' as Platform,
        userId: 'user123',
      }));

      mockGeneratedContentService.getGeneratedContent.mockResolvedValue(mockContent);
      mockLearningProfileService.getLearningProfile.mockResolvedValue(null); // No existing profile
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockAllFeedback);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockAllContent);
      mockLearningProfileService.createLearningProfile.mockResolvedValue(undefined);

      await learningIntegrationService.updateLearningProfiles(feedback);

      expect(mockLearningProfileService.createLearningProfile).toHaveBeenCalled();
    });
  });

  describe('getLearningInsights', () => {
    it('should generate learning insights for user with profiles', async () => {
      const userId = 'user123';
      
      const mockProfiles = [
        {
          profileKey: 'user123:twitter:social-post',
          userId,
          platform: 'twitter' as Platform,
          contentType: 'social-post' as ContentType,
          trainingDataSize: 25,
          lastUpdated: '2024-01-01T00:00:00Z',
          modelVersion: 'v1',
          confidenceScore: 0.8,
        },
        {
          profileKey: 'user123:facebook:social-post',
          userId,
          platform: 'facebook' as Platform,
          contentType: 'social-post' as ContentType,
          trainingDataSize: 15,
          lastUpdated: '2024-01-01T00:00:00Z',
          modelVersion: 'v1',
          confidenceScore: 0.6,
        },
      ];

      mockLearningProfileService.getUserLearningProfiles.mockResolvedValue(mockProfiles);
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);

      const result = await learningIntegrationService.getLearningInsights(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.profileSummary).toBeDefined();
      expect(Object.keys(result.profileSummary)).toHaveLength(2);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should handle user with no learning profiles', async () => {
      const userId = 'user123';
      
      mockLearningProfileService.getUserLearningProfiles.mockResolvedValue([]);

      const result = await learningIntegrationService.getLearningInsights(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(Object.keys(result.profileSummary)).toHaveLength(0);
      expect(result.recommendations).toBeDefined();
    });
  });

  describe('trainUserPreferenceModel', () => {
    it('should throw error when insufficient training data', async () => {
      const userId = 'user123';
      
      // Mock insufficient feedback data
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue([]);

      await expect(
        learningIntegrationService.trainUserPreferenceModel(userId)
      ).rejects.toThrow('Insufficient training data');
    });
  });
});

// Integration tests
describe('Learning Integration - Integration Tests', () => {
  describe('End-to-end learning workflow', () => {
    it('should handle complete learning workflow', async () => {
      const userId = 'user123';
      const platform: Platform = 'twitter';
      const contentType: ContentType = 'social-post';

      // Step 1: Initially no profile exists
      mockLearningProfileService.getLearningProfile.mockResolvedValue(null);
      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue([]);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue([]);

      let profile = await learningIntegrationService.getLearningProfile(userId, platform, contentType);
      expect(profile).toBeNull();

      // Step 2: Add feedback data
      const mockFeedback: EngagementFeedback[] = Array.from({ length: 10 }, (_, i) => ({
        feedbackId: `feedback${i}`,
        contentId: `content${i}`,
        userId,
        platform,
        metrics: {
          likes: 10 + i,
          shares: 2 + i,
          comments: 1 + i,
          clickThroughRate: 0.05 + (i * 0.01),
          engagementRate: 0.08 + (i * 0.01),
        },
        timestamp: new Date().toISOString(),
      }));

      const mockContent = Array.from({ length: 10 }, (_, i) => ({
        contentId: `content${i}`,
        contentType,
        platform,
        userId,
      }));

      mockEngagementFeedbackService.getUserFeedback.mockResolvedValue(mockFeedback);
      mockGeneratedContentService.getUserGeneratedContent.mockResolvedValue(mockContent);
      mockLearningProfileService.createLearningProfile.mockResolvedValue(undefined);

      // Step 3: Profile should be created with sufficient data
      profile = await learningIntegrationService.getLearningProfile(userId, platform, contentType);
      expect(profile).toBeDefined();
      expect(profile?.trainingDataSize).toBe(10);

      // Step 4: Apply learned preferences
      const contentOptions = {
        contentIdea: 'Test content idea',
        userId,
        intent: 'promotional' as const,
      };

      const mockProfileWithEndpoint = {
        ...profile!,
        modelEndpoint: 'test-endpoint',
      };

      mockLearningProfileService.getLearningProfile.mockResolvedValue(mockProfileWithEndpoint);

      const enhancedOptions = await learningIntegrationService.applyLearnedPreferences(
        userId,
        contentOptions,
        platform,
        contentType
      );

      expect(enhancedOptions).toBeDefined();
      expect(enhancedOptions.learningMetadata?.modelUsed).toBe(true);
    });
  });
});
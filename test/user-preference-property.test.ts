// Property-based tests for user preference management
// Set up environment variables BEFORE importing handlers
process.env.AWS_REGION = 'us-east-1';
process.env.USER_POOL_ID = 'us-east-1_test123';
process.env.USER_POOL_CLIENT_ID = 'test-client-id';
process.env.USERS_TABLE_NAME = 'test-users-table';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';

import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as updatePreferencesHandler } from '../src/lambda/auth/update-preferences';
import { handler as getProfileHandler } from '../src/lambda/auth/get-profile';
import { generateJWT } from '../src/utils';
import { userService } from '../src/services/database';
import { UserProfile, Platform, ContentType } from '../src/types';

jest.mock('../src/services/database', () => ({
  userService: {
    getUserByEmail: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUserPreferences: jest.fn(),
  },
}));

const mockUserService = userService as jest.Mocked<typeof userService>;

// Helper function to create mock API Gateway event
function createMockEvent(
  httpMethod: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    httpMethod,
    path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    headers: headers || { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null,
    requestContext: {
      requestId: 'test-request-id',
      stage: 'test',
      resourceId: 'test-resource',
      httpMethod,
      resourcePath: path,
      path: `/test${path}`,
      accountId: '123456789012',
      apiId: 'test-api-id',
      protocol: 'HTTP/1.1',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200,
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
        clientCert: null,
      },
      authorizer: null,
    },
    resource: path,
    stageVariables: null,
    isBase64Encoded: false,
  };
}

// Property-based test generators
function generateValidBrandVoice(): string {
  const validBrandVoices = ['professional', 'casual', 'friendly', 'authoritative', 'conversational', 'formal'];
  return validBrandVoices[Math.floor(Math.random() * validBrandVoices.length)];
}

function generateValidPlatforms(): Platform[] {
  const allPlatforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
  const numPlatforms = Math.floor(Math.random() * allPlatforms.length) + 1; // At least 1 platform
  const shuffled = allPlatforms.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numPlatforms);
}

function generateValidContentStyle(): string {
  const validContentStyles = ['informative', 'entertaining', 'persuasive', 'educational', 'inspirational'];
  return validContentStyles[Math.floor(Math.random() * validContentStyles.length)];
}

function generateValidAgeRange(): string {
  const validAgeRanges = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', '18-34', '25-45', '35-55'];
  return validAgeRanges[Math.floor(Math.random() * validAgeRanges.length)];
}

function generateValidContentTypes(): ContentType[] {
  const allContentTypes: ContentType[] = ['blog-post', 'social-post', 'caption', 'script', 'email', 'ad-copy'];
  const numTypes = Math.floor(Math.random() * allContentTypes.length) + 1; // At least 1 type
  const shuffled = allContentTypes.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numTypes);
}

function generateValidEngagementTimes(): string[] {
  const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
  const numTimes = Math.floor(Math.random() * 4) + 1; // 1-4 times
  const shuffled = hours.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numTimes);
}

function generateInvalidBrandVoice(): string {
  const invalidBrandVoices = ['invalid-voice', 'wrong', 'bad-voice', '', 'unknown'];
  return invalidBrandVoices[Math.floor(Math.random() * invalidBrandVoices.length)];
}

function generateInvalidPlatforms(): string[] {
  const invalidPlatforms = ['invalid-platform', 'wrong', 'bad-platform', '', 'unknown'];
  return [invalidPlatforms[Math.floor(Math.random() * invalidPlatforms.length)]];
}

function generateInvalidEngagementTimes(): string[] {
  const invalidTimes = ['25:00', 'invalid-time', '24:60', '', '9:00am', 'morning'];
  return [invalidTimes[Math.floor(Math.random() * invalidTimes.length)]];
}

// Mock user profile for testing
function createMockUserProfile(userId: string): UserProfile {
  return {
    userId,
    email: `user${userId}@example.com`,
    preferences: {
      brandVoice: 'professional',
      targetAudience: {
        profileId: `profile_${userId}`,
        userId,
        demographics: {
          ageRange: '25-45',
          location: 'global',
          interests: ['technology'],
        },
        behaviorPatterns: {
          preferredContentTypes: ['blog-post'],
          engagementTimes: ['9:00', '17:00'],
          platformUsage: {
            blog: {
              frequency: 'daily',
              engagementRate: 0.05,
              preferredContentLength: 'long',
              bestPostingTimes: ['9:00', '17:00'],
            },
            twitter: { frequency: 'never', engagementRate: 0, preferredContentLength: 'short', bestPostingTimes: [] },
            facebook: { frequency: 'never', engagementRate: 0, preferredContentLength: 'medium', bestPostingTimes: [] },
            instagram: { frequency: 'never', engagementRate: 0, preferredContentLength: 'short', bestPostingTimes: [] },
            linkedin: { frequency: 'never', engagementRate: 0, preferredContentLength: 'medium', bestPostingTimes: [] },
            youtube: { frequency: 'never', engagementRate: 0, preferredContentLength: 'long', bestPostingTimes: [] },
            tiktok: { frequency: 'never', engagementRate: 0, preferredContentLength: 'short', bestPostingTimes: [] },
          },
        },
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      preferredPlatforms: ['blog'],
      contentStyle: 'informative',
    },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('User Preference Management Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 14: User Preference Management', () => {
    /**
     * **Validates: Requirements 6.3**
     * 
     * Property: For any user preference update (brand voice, target audience, platform preferences), 
     * the system should store and apply these preferences to future content generation
     */

    it('should always store and retrieve valid brand voice preferences', async () => {
      // Property: For any valid brand voice, the system should store and retrieve it correctly
      const iterations = 30;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const brandVoice = generateValidBrandVoice();
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        const updatedProfile = {
          ...mockProfile,
          preferences: {
            ...mockProfile.preferences,
            brandVoice,
          },
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        // Mock database calls
        mockUserService.getUserById.mockResolvedValue(mockProfile);
        mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          brandVoice,
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(200);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.preferences.brandVoice).toBe(brandVoice);
        
        // Verify the preference was stored correctly
        expect(mockUserService.updateUserPreferences).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            brandVoice,
          })
        );
      }
    });

    it('should always store and retrieve valid platform preferences', async () => {
      // Property: For any valid platform list, the system should store and retrieve it correctly
      const iterations = 25;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const preferredPlatforms = generateValidPlatforms();
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        const updatedProfile = {
          ...mockProfile,
          preferences: {
            ...mockProfile.preferences,
            preferredPlatforms,
          },
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        // Mock database calls
        mockUserService.getUserById.mockResolvedValue(mockProfile);
        mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          preferredPlatforms,
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(200);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.preferences.preferredPlatforms).toEqual(preferredPlatforms);
        
        // Verify the preference was stored correctly
        expect(mockUserService.updateUserPreferences).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            preferredPlatforms,
          })
        );
      }
    });

    it('should always store and retrieve valid target audience preferences', async () => {
      // Property: For any valid target audience data, the system should store and retrieve it correctly
      const iterations = 20;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const ageRange = generateValidAgeRange();
        const preferredContentTypes = generateValidContentTypes();
        const engagementTimes = generateValidEngagementTimes();
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        const updatedProfile = {
          ...mockProfile,
          preferences: {
            ...mockProfile.preferences,
            targetAudience: {
              ...mockProfile.preferences.targetAudience,
              demographics: {
                ...mockProfile.preferences.targetAudience.demographics,
                ageRange,
              },
              behaviorPatterns: {
                ...mockProfile.preferences.targetAudience.behaviorPatterns,
                preferredContentTypes,
                engagementTimes,
              },
            },
          },
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        // Mock database calls
        mockUserService.getUserById.mockResolvedValue(mockProfile);
        mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          targetAudience: {
            demographics: {
              ageRange,
            },
            behaviorPatterns: {
              preferredContentTypes,
              engagementTimes,
            },
          },
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(200);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        expect(responseBody.data.preferences.targetAudience.demographics.ageRange).toBe(ageRange);
        expect(responseBody.data.preferences.targetAudience.behaviorPatterns.preferredContentTypes).toEqual(preferredContentTypes);
        expect(responseBody.data.preferences.targetAudience.behaviorPatterns.engagementTimes).toEqual(engagementTimes);
        
        // Verify the preference was stored correctly
        expect(mockUserService.updateUserPreferences).toHaveBeenCalledWith(
          userId,
          expect.objectContaining({
            targetAudience: expect.objectContaining({
              demographics: expect.objectContaining({
                ageRange,
              }),
              behaviorPatterns: expect.objectContaining({
                preferredContentTypes,
                engagementTimes,
              }),
            }),
          })
        );
      }
    });

    it('should always reject invalid brand voice preferences', async () => {
      // Property: For any invalid brand voice, the system should reject the update
      const iterations = 15;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const invalidBrandVoice = generateInvalidBrandVoice();
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        mockUserService.getUserById.mockResolvedValue(mockProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          brandVoice: invalidBrandVoice,
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(400);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.code).toBe('VALIDATION_ERROR');
        expect(responseBody.error.details[0]).toContain('Invalid brand voice');
        
        // Verify no update was attempted
        expect(mockUserService.updateUserPreferences).not.toHaveBeenCalled();
      }
    });

    it('should always reject invalid platform preferences', async () => {
      // Property: For any invalid platform list, the system should reject the update
      const iterations = 15;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const invalidPlatforms = generateInvalidPlatforms();
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        mockUserService.getUserById.mockResolvedValue(mockProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          preferredPlatforms: invalidPlatforms,
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(400);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.code).toBe('VALIDATION_ERROR');
        expect(responseBody.error.details[0]).toContain('Invalid platforms');
        
        // Verify no update was attempted
        expect(mockUserService.updateUserPreferences).not.toHaveBeenCalled();
      }
    });

    it('should always reject invalid engagement time formats', async () => {
      // Property: For any invalid engagement time format, the system should reject the update
      const iterations = 15;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const invalidEngagementTimes = generateInvalidEngagementTimes();
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        mockUserService.getUserById.mockResolvedValue(mockProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          targetAudience: {
            behaviorPatterns: {
              engagementTimes: invalidEngagementTimes,
            },
          },
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(400);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(false);
        expect(responseBody.error.code).toBe('VALIDATION_ERROR');
        expect(responseBody.error.details[0]).toContain('Invalid time format');
        
        // Verify no update was attempted
        expect(mockUserService.updateUserPreferences).not.toHaveBeenCalled();
      }
    });

    it('should always maintain preference consistency across updates', async () => {
      // Property: For any sequence of valid preference updates, the system should maintain consistency
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        let currentProfile = createMockUserProfile(userId);
        
        // Perform multiple updates
        const updates = [
          { brandVoice: generateValidBrandVoice() },
          { preferredPlatforms: generateValidPlatforms() },
          { contentStyle: generateValidContentStyle() },
        ];
        
        for (const update of updates) {
          // Update the mock profile with the new preference
          const updatedProfile = {
            ...currentProfile,
            preferences: {
              ...currentProfile.preferences,
              ...update,
            },
            updatedAt: new Date().toISOString(),
          };
          
          mockUserService.getUserById.mockResolvedValue(currentProfile);
          mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

          const event = createMockEvent('PUT', '/auth/profile/preferences', update, {
            Authorization: `Bearer ${token}`,
          });

          const result = await updatePreferencesHandler(event);
          
          // Property assertions
          expect(result.statusCode).toBe(200);
          
          const responseBody = JSON.parse(result.body);
          expect(responseBody.success).toBe(true);
          
          // Verify the specific update was applied
          Object.keys(update).forEach(key => {
            expect(responseBody.data.preferences[key]).toEqual(update[key as keyof typeof update]);
          });
          
          // Update current profile for next iteration
          currentProfile = updatedProfile;
          jest.clearAllMocks();
        }
      }
    });

    it('should always preserve existing preferences when updating specific fields', async () => {
      // Property: For any partial preference update, existing preferences should be preserved
      const iterations = 15;
      
      for (let i = 0; i < iterations; i++) {
        const userId = `user_${i}`;
        const token = generateJWT({ userId, email: `user${i}@example.com` });
        
        const mockProfile = createMockUserProfile(userId);
        const originalBrandVoice = mockProfile.preferences.brandVoice;
        const originalPlatforms = mockProfile.preferences.preferredPlatforms;
        
        // Update only content style
        const newContentStyle = generateValidContentStyle();
        const updatedProfile = {
          ...mockProfile,
          preferences: {
            ...mockProfile.preferences,
            contentStyle: newContentStyle,
          },
          updatedAt: '2024-01-02T00:00:00.000Z',
        };

        mockUserService.getUserById.mockResolvedValue(mockProfile);
        mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

        const event = createMockEvent('PUT', '/auth/profile/preferences', {
          contentStyle: newContentStyle,
        }, {
          Authorization: `Bearer ${token}`,
        });

        const result = await updatePreferencesHandler(event);
        
        // Property assertions
        expect(result.statusCode).toBe(200);
        
        const responseBody = JSON.parse(result.body);
        expect(responseBody.success).toBe(true);
        
        // Verify the new preference was applied
        expect(responseBody.data.preferences.contentStyle).toBe(newContentStyle);
        
        // Verify existing preferences were preserved
        expect(responseBody.data.preferences.brandVoice).toBe(originalBrandVoice);
        expect(responseBody.data.preferences.preferredPlatforms).toEqual(originalPlatforms);
      }
    });
  });
});
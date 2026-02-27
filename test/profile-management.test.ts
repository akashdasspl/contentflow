// Unit tests for profile management Lambda functions
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler as getProfileHandler } from '../src/lambda/auth/get-profile';
import { handler as updateProfileHandler } from '../src/lambda/auth/update-profile';
import { handler as updatePreferencesHandler } from '../src/lambda/auth/update-preferences';
import { userService } from '../src/services/database';
import { generateJWT } from '../src/utils';
import { UserProfile, Platform, ContentType } from '../src/types';

// Mock the database services
jest.mock('../src/services/database');

const mockUserService = userService as jest.Mocked<typeof userService>;

// Mock user profile data
const mockUserProfile: UserProfile = {
  userId: 'user_123',
  email: 'test@example.com',
  preferences: {
    brandVoice: 'professional',
    targetAudience: {
      profileId: 'profile_123',
      userId: 'user_123',
      demographics: {
        ageRange: '25-45',
        location: 'global',
        interests: ['technology', 'business'],
      },
      behaviorPatterns: {
        preferredContentTypes: ['blog-post'] as ContentType[],
        engagementTimes: ['9:00', '17:00'],
        platformUsage: {
          blog: {
            frequency: 'daily',
            engagementRate: 0.05,
            preferredContentLength: 'long',
            bestPostingTimes: ['9:00', '17:00'],
          },
          twitter: {
            frequency: 'never',
            engagementRate: 0,
            preferredContentLength: 'short',
            bestPostingTimes: [],
          },
          facebook: {
            frequency: 'never',
            engagementRate: 0,
            preferredContentLength: 'medium',
            bestPostingTimes: [],
          },
          instagram: {
            frequency: 'never',
            engagementRate: 0,
            preferredContentLength: 'short',
            bestPostingTimes: [],
          },
          linkedin: {
            frequency: 'never',
            engagementRate: 0,
            preferredContentLength: 'medium',
            bestPostingTimes: [],
          },
          youtube: {
            frequency: 'never',
            engagementRate: 0,
            preferredContentLength: 'long',
            bestPostingTimes: [],
          },
          tiktok: {
            frequency: 'never',
            engagementRate: 0,
            preferredContentLength: 'short',
            bestPostingTimes: [],
          },
        },
      },
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    preferredPlatforms: ['blog'] as Platform[],
    contentStyle: 'informative',
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

// Helper function to create mock API Gateway event
function createMockEvent(
  httpMethod: string,
  path: string,
  body?: string,
  headers?: Record<string, string>,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    httpMethod,
    path,
    pathParameters: null,
    queryStringParameters,
    headers: headers || {},
    body,
    requestContext: {
      requestId: 'test-request-id',
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
      },
    },
  } as APIGatewayProxyEvent;
}

describe('Profile Management Lambda Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.USER_POOL_ID = 'test-pool-id';
  });

  describe('Get Profile Handler', () => {
    it('should return user profile successfully', async () => {
      // Arrange
      const token = generateJWT({ userId: 'user_123', email: 'test@example.com' });
      const event = createMockEvent('GET', '/auth/profile', undefined, {
        Authorization: `Bearer ${token}`,
      });

      mockUserService.getUserById.mockResolvedValue(mockUserProfile);

      // Act
      const result = await getProfileHandler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.userId).toBe('user_123');
      expect(responseBody.data.email).toBe('test@example.com');
      expect(mockUserService.getUserById).toHaveBeenCalledWith('user_123');
    });

    it('should return 401 when no token provided', async () => {
      // Arrange
      const event = createMockEvent('GET', '/auth/profile');

      // Act
      const result = await getProfileHandler(event);

      // Assert
      expect(result.statusCode).toBe(401);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('Authorization token is required');
    });

    it('should return 404 when user profile not found', async () => {
      // Arrange
      const token = generateJWT({ userId: 'user_123', email: 'test@example.com' });
      const event = createMockEvent('GET', '/auth/profile', undefined, {
        Authorization: `Bearer ${token}`,
      });

      mockUserService.getUserById.mockResolvedValue(null);

      // Act
      const result = await getProfileHandler(event);

      // Assert
      expect(result.statusCode).toBe(404);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.message).toBe('User profile not found');
    });
  });

  describe('Update Profile Handler', () => {
    it('should update user profile successfully', async () => {
      // Arrange
      const token = generateJWT({ userId: 'user_123', email: 'test@example.com' });
      const updateData = {
        preferences: {
          brandVoice: 'casual',
          preferredPlatforms: ['blog', 'twitter'] as Platform[],
        },
      };
      const event = createMockEvent('PUT', '/auth/profile', JSON.stringify(updateData), {
        Authorization: `Bearer ${token}`,
      });

      const updatedProfile: UserProfile = {
        ...mockUserProfile,
        preferences: {
          ...mockUserProfile.preferences,
          brandVoice: 'casual',
          preferredPlatforms: ['blog', 'twitter'] as Platform[],
        },
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockUserService.getUserById.mockResolvedValue(mockUserProfile);
      mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

      // Act
      const result = await updateProfileHandler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.preferences.brandVoice).toBe('casual');
      expect(responseBody.data.preferences.preferredPlatforms).toEqual(['blog', 'twitter']);
    });

    it('should return 400 for invalid brand voice', async () => {
      // Arrange
      const token = generateJWT({ userId: 'user_123', email: 'test@example.com' });
      const updateData = {
        preferences: {
          brandVoice: 'invalid-voice',
        },
      };
      const event = createMockEvent('PUT', '/auth/profile', JSON.stringify(updateData), {
        Authorization: `Bearer ${token}`,
      });

      // Act
      const result = await updateProfileHandler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Update Preferences Handler', () => {
    it('should update user preferences successfully', async () => {
      // Arrange
      const token = generateJWT({ userId: 'user_123', email: 'test@example.com' });
      const updateData = {
        brandVoice: 'friendly',
        preferredPlatforms: ['blog', 'linkedin'] as Platform[],
        targetAudience: {
          demographics: {
            ageRange: '35-55',
            interests: ['technology', 'business', 'marketing'],
          },
        },
      };
      const event = createMockEvent('PUT', '/auth/profile/preferences', JSON.stringify(updateData), {
        Authorization: `Bearer ${token}`,
      });

      const updatedProfile: UserProfile = {
        ...mockUserProfile,
        preferences: {
          ...mockUserProfile.preferences,
          brandVoice: 'friendly',
          preferredPlatforms: ['blog', 'linkedin'] as Platform[],
          targetAudience: {
            ...mockUserProfile.preferences.targetAudience,
            demographics: {
              ...mockUserProfile.preferences.targetAudience.demographics,
              ageRange: '35-55',
              interests: ['technology', 'business', 'marketing'],
            },
          },
        },
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockUserService.getUserById.mockResolvedValue(mockUserProfile);
      mockUserService.updateUserPreferences.mockResolvedValue(updatedProfile);

      // Act
      const result = await updatePreferencesHandler(event);

      // Assert
      expect(result.statusCode).toBe(200);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(true);
      expect(responseBody.data.preferences.brandVoice).toBe('friendly');
      expect(responseBody.data.preferences.preferredPlatforms).toEqual(['blog', 'linkedin']);
      expect(responseBody.data.preferences.targetAudience.demographics.ageRange).toBe('35-55');
    });

    it('should validate engagement times format', async () => {
      // Arrange
      const token = generateJWT({ userId: 'user_123', email: 'test@example.com' });
      const updateData = {
        targetAudience: {
          behaviorPatterns: {
            engagementTimes: ['invalid-time', '25:00'],
          },
        },
      };
      const event = createMockEvent('PUT', '/auth/profile/preferences', JSON.stringify(updateData), {
        Authorization: `Bearer ${token}`,
      });

      // Act
      const result = await updatePreferencesHandler(event);

      // Assert
      expect(result.statusCode).toBe(400);
      const responseBody = JSON.parse(result.body);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('VALIDATION_ERROR');
      expect(responseBody.error.details[0]).toContain('Invalid time format');
    });
  });
});
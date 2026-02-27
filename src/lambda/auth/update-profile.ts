// Update user profile Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  extractTokenFromEvent,
  verifyJWT,
  validateRequired,
  getCurrentTimestamp,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';
import { UserPreferences, Platform, ContentType } from '../../types';

interface UpdateProfileRequest {
  preferences?: Partial<UserPreferences>;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Update user profile request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token is required', 401);
    }

    let decodedToken;
    try {
      decodedToken = verifyJWT(token);
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    const userId = decodedToken.userId;
    if (!userId) {
      return createErrorResponse('Invalid token payload', 401);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    const requestBody: UpdateProfileRequest = JSON.parse(event.body);

    // Validate preferences if provided
    if (requestBody.preferences) {
      const validationErrors = validatePreferences(requestBody.preferences);
      if (validationErrors.length > 0) {
        return createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validationErrors,
          timestamp: getCurrentTimestamp(),
        }, 400);
      }
    }

    // Get current user profile
    const currentProfile = await userService.getUserById(userId);
    if (!currentProfile) {
      return createErrorResponse('User profile not found', 404);
    }

    // Merge preferences with existing ones
    const updatedPreferences = requestBody.preferences 
      ? { ...currentProfile.preferences, ...requestBody.preferences }
      : currentProfile.preferences;

    // Update user preferences in database
    const updatedProfile = await userService.updateUserPreferences(userId, updatedPreferences);

    logInfo('User profile updated successfully', { userId });

    // Return updated profile without sensitive information
    const profileResponse = {
      userId: updatedProfile.userId,
      email: updatedProfile.email,
      preferences: updatedProfile.preferences,
      createdAt: updatedProfile.createdAt,
      updatedAt: updatedProfile.updatedAt,
    };

    return createSuccessResponse(profileResponse, 200);

  } catch (error: any) {
    logError('Update profile error', error);
    return handleLambdaError(error);
  }
};

// Helper function to validate preferences
function validatePreferences(preferences: Partial<UserPreferences>): string[] {
  const errors: string[] = [];

  // Validate brand voice
  if (preferences.brandVoice !== undefined) {
    const validBrandVoices = ['professional', 'casual', 'friendly', 'authoritative', 'conversational', 'formal'];
    if (!validBrandVoices.includes(preferences.brandVoice)) {
      errors.push(`Invalid brand voice. Must be one of: ${validBrandVoices.join(', ')}`);
    }
  }

  // Validate preferred platforms
  if (preferences.preferredPlatforms !== undefined) {
    const validPlatforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
    const invalidPlatforms = preferences.preferredPlatforms.filter(platform => !validPlatforms.includes(platform));
    if (invalidPlatforms.length > 0) {
      errors.push(`Invalid platforms: ${invalidPlatforms.join(', ')}. Valid platforms: ${validPlatforms.join(', ')}`);
    }
  }

  // Validate content style
  if (preferences.contentStyle !== undefined) {
    const validContentStyles = ['informative', 'entertaining', 'persuasive', 'educational', 'inspirational'];
    if (!validContentStyles.includes(preferences.contentStyle)) {
      errors.push(`Invalid content style. Must be one of: ${validContentStyles.join(', ')}`);
    }
  }

  // Validate target audience demographics if provided
  if (preferences.targetAudience?.demographics) {
    const demographics = preferences.targetAudience.demographics;
    
    if (demographics.ageRange !== undefined) {
      const validAgeRanges = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', '18-34', '25-45', '35-55'];
      if (!validAgeRanges.includes(demographics.ageRange)) {
        errors.push(`Invalid age range. Must be one of: ${validAgeRanges.join(', ')}`);
      }
    }

    if (demographics.interests !== undefined && !Array.isArray(demographics.interests)) {
      errors.push('Interests must be an array of strings');
    }
  }

  // Validate behavior patterns if provided
  if (preferences.targetAudience?.behaviorPatterns) {
    const behaviorPatterns = preferences.targetAudience.behaviorPatterns;
    
    if (behaviorPatterns.preferredContentTypes !== undefined) {
      const validContentTypes: ContentType[] = ['blog-post', 'social-post', 'caption', 'script', 'email', 'ad-copy'];
      const invalidContentTypes = behaviorPatterns.preferredContentTypes.filter(type => !validContentTypes.includes(type));
      if (invalidContentTypes.length > 0) {
        errors.push(`Invalid content types: ${invalidContentTypes.join(', ')}. Valid types: ${validContentTypes.join(', ')}`);
      }
    }

    if (behaviorPatterns.engagementTimes !== undefined && !Array.isArray(behaviorPatterns.engagementTimes)) {
      errors.push('Engagement times must be an array of time strings (e.g., ["9:00", "17:00"])');
    }
  }

  return errors;
}
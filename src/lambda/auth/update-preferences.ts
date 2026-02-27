// Update user preferences Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  extractTokenFromEvent,
  verifyJWT,
  getCurrentTimestamp,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';
import { UserPreferences, Platform, ContentType } from '../../types';

interface UpdatePreferencesRequest {
  brandVoice?: string;
  preferredPlatforms?: Platform[];
  contentStyle?: string;
  targetAudience?: {
    demographics?: {
      ageRange?: string;
      location?: string;
      interests?: string[];
      gender?: string;
      income?: string;
      education?: string;
    };
    behaviorPatterns?: {
      preferredContentTypes?: ContentType[];
      engagementTimes?: string[];
      platformUsage?: Record<Platform, {
        frequency?: string;
        engagementRate?: number;
        preferredContentLength?: string;
        bestPostingTimes?: string[];
      }>;
    };
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Update user preferences request received', { 
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

    const requestBody: UpdatePreferencesRequest = JSON.parse(event.body);

    // Validate preferences
    const validationErrors = validatePreferencesUpdate(requestBody);
    if (validationErrors.length > 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationErrors,
        timestamp: getCurrentTimestamp(),
      }, 400);
    }

    // Get current user profile
    const currentProfile = await userService.getUserById(userId);
    if (!currentProfile) {
      return createErrorResponse('User profile not found', 404);
    }

    // Deep merge preferences
    const updatedPreferences = deepMergePreferences(currentProfile.preferences, requestBody);

    // Update user preferences in database
    const updatedProfile = await userService.updateUserPreferences(userId, updatedPreferences);

    logInfo('User preferences updated successfully', { 
      userId,
      updatedFields: Object.keys(requestBody)
    });

    // Return updated preferences
    const preferencesResponse = {
      userId: updatedProfile.userId,
      preferences: updatedProfile.preferences,
      updatedAt: updatedProfile.updatedAt,
    };

    return createSuccessResponse(preferencesResponse, 200);

  } catch (error: any) {
    logError('Update preferences error', error);
    return handleLambdaError(error);
  }
};

// Helper function to validate preferences update
function validatePreferencesUpdate(preferences: UpdatePreferencesRequest): string[] {
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
    if (!Array.isArray(preferences.preferredPlatforms)) {
      errors.push('Preferred platforms must be an array');
    } else {
      const validPlatforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
      const invalidPlatforms = preferences.preferredPlatforms.filter(platform => !validPlatforms.includes(platform));
      if (invalidPlatforms.length > 0) {
        errors.push(`Invalid platforms: ${invalidPlatforms.join(', ')}. Valid platforms: ${validPlatforms.join(', ')}`);
      }
    }
  }

  // Validate content style
  if (preferences.contentStyle !== undefined) {
    const validContentStyles = ['informative', 'entertaining', 'persuasive', 'educational', 'inspirational'];
    if (!validContentStyles.includes(preferences.contentStyle)) {
      errors.push(`Invalid content style. Must be one of: ${validContentStyles.join(', ')}`);
    }
  }

  // Validate target audience demographics
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

    if (demographics.gender !== undefined) {
      const validGenders = ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'];
      if (!validGenders.includes(demographics.gender)) {
        errors.push(`Invalid gender. Must be one of: ${validGenders.join(', ')}`);
      }
    }

    if (demographics.income !== undefined) {
      const validIncomeRanges = ['under-25k', '25k-50k', '50k-75k', '75k-100k', '100k-150k', 'over-150k'];
      if (!validIncomeRanges.includes(demographics.income)) {
        errors.push(`Invalid income range. Must be one of: ${validIncomeRanges.join(', ')}`);
      }
    }

    if (demographics.education !== undefined) {
      const validEducationLevels = ['high-school', 'some-college', 'bachelors', 'masters', 'doctorate', 'other'];
      if (!validEducationLevels.includes(demographics.education)) {
        errors.push(`Invalid education level. Must be one of: ${validEducationLevels.join(', ')}`);
      }
    }
  }

  // Validate behavior patterns
  if (preferences.targetAudience?.behaviorPatterns) {
    const behaviorPatterns = preferences.targetAudience.behaviorPatterns;
    
    if (behaviorPatterns.preferredContentTypes !== undefined) {
      if (!Array.isArray(behaviorPatterns.preferredContentTypes)) {
        errors.push('Preferred content types must be an array');
      } else {
        const validContentTypes: ContentType[] = ['blog-post', 'social-post', 'caption', 'script', 'email', 'ad-copy'];
        const invalidContentTypes = behaviorPatterns.preferredContentTypes.filter(type => !validContentTypes.includes(type));
        if (invalidContentTypes.length > 0) {
          errors.push(`Invalid content types: ${invalidContentTypes.join(', ')}. Valid types: ${validContentTypes.join(', ')}`);
        }
      }
    }

    if (behaviorPatterns.engagementTimes !== undefined) {
      if (!Array.isArray(behaviorPatterns.engagementTimes)) {
        errors.push('Engagement times must be an array of time strings (e.g., ["9:00", "17:00"])');
      } else {
        // Validate time format (HH:MM)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        const invalidTimes = behaviorPatterns.engagementTimes.filter(time => !timeRegex.test(time));
        if (invalidTimes.length > 0) {
          errors.push(`Invalid time format: ${invalidTimes.join(', ')}. Use HH:MM format (e.g., "09:00", "17:30")`);
        }
      }
    }

    if (behaviorPatterns.platformUsage !== undefined) {
      const validPlatforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
      const validFrequencies = ['never', 'rarely', 'weekly', 'daily', 'multiple-times-daily'];
      const validContentLengths = ['short', 'medium', 'long'];

      Object.entries(behaviorPatterns.platformUsage).forEach(([platform, usage]) => {
        if (!validPlatforms.includes(platform as Platform)) {
          errors.push(`Invalid platform in usage: ${platform}`);
        }

        if (usage.frequency !== undefined && !validFrequencies.includes(usage.frequency)) {
          errors.push(`Invalid frequency for ${platform}. Must be one of: ${validFrequencies.join(', ')}`);
        }

        if (usage.engagementRate !== undefined && (typeof usage.engagementRate !== 'number' || usage.engagementRate < 0 || usage.engagementRate > 1)) {
          errors.push(`Invalid engagement rate for ${platform}. Must be a number between 0 and 1`);
        }

        if (usage.preferredContentLength !== undefined && !validContentLengths.includes(usage.preferredContentLength)) {
          errors.push(`Invalid content length for ${platform}. Must be one of: ${validContentLengths.join(', ')}`);
        }

        if (usage.bestPostingTimes !== undefined) {
          if (!Array.isArray(usage.bestPostingTimes)) {
            errors.push(`Best posting times for ${platform} must be an array`);
          } else {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            const invalidTimes = usage.bestPostingTimes.filter(time => !timeRegex.test(time));
            if (invalidTimes.length > 0) {
              errors.push(`Invalid time format for ${platform}: ${invalidTimes.join(', ')}. Use HH:MM format`);
            }
          }
        }
      });
    }
  }

  return errors;
}

// Helper function to deep merge preferences
function deepMergePreferences(
  currentPreferences: UserPreferences, 
  updates: UpdatePreferencesRequest
): UserPreferences {
  const merged = { ...currentPreferences };

  // Update simple fields
  if (updates.brandVoice !== undefined) {
    merged.brandVoice = updates.brandVoice;
  }

  if (updates.preferredPlatforms !== undefined) {
    merged.preferredPlatforms = updates.preferredPlatforms;
  }

  if (updates.contentStyle !== undefined) {
    merged.contentStyle = updates.contentStyle;
  }

  // Deep merge target audience
  if (updates.targetAudience) {
    if (updates.targetAudience.demographics) {
      merged.targetAudience.demographics = {
        ...merged.targetAudience.demographics,
        ...updates.targetAudience.demographics,
      };
    }

    if (updates.targetAudience.behaviorPatterns) {
      // Create a properly typed behavior patterns object
      const updatedBehaviorPatterns: Partial<typeof merged.targetAudience.behaviorPatterns> = {
        ...merged.targetAudience.behaviorPatterns,
      };

      if (updates.targetAudience.behaviorPatterns.preferredContentTypes !== undefined) {
        updatedBehaviorPatterns.preferredContentTypes = updates.targetAudience.behaviorPatterns.preferredContentTypes;
      }

      if (updates.targetAudience.behaviorPatterns.engagementTimes !== undefined) {
        updatedBehaviorPatterns.engagementTimes = updates.targetAudience.behaviorPatterns.engagementTimes;
      }

      // Deep merge platform usage
      if (updates.targetAudience.behaviorPatterns.platformUsage) {
        updatedBehaviorPatterns.platformUsage = {
          ...merged.targetAudience.behaviorPatterns.platformUsage,
        };

        Object.entries(updates.targetAudience.behaviorPatterns.platformUsage).forEach(([platform, usage]) => {
          if (updatedBehaviorPatterns.platformUsage) {
            updatedBehaviorPatterns.platformUsage[platform as Platform] = {
              ...updatedBehaviorPatterns.platformUsage[platform as Platform],
              ...usage,
            };
          }
        });
      }

      merged.targetAudience.behaviorPatterns = updatedBehaviorPatterns as typeof merged.targetAudience.behaviorPatterns;
    }

    // Update the updatedAt timestamp for target audience
    merged.targetAudience.updatedAt = getCurrentTimestamp();
  }

  return merged;
}
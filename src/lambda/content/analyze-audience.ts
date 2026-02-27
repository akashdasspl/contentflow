// Lambda function for audience analysis
// Requirements: 2.1, 2.4

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { audienceAnalysisService } from '../../services/audience-analysis';
import { contentIdeaService } from '../../services/database';
import {
  createSuccessResponse,
  createErrorResponse,
  handleLambdaError,
  validateRequired,
  extractTokenFromEvent,
  verifyJWT,
  logInfo,
  logError,
} from '../../utils';
import {
  AudienceAnalysisResult,
  AudienceAnalysisOptions,
  ContentIdea,
} from '../../types';

interface AnalyzeAudienceRequest {
  text?: string;
  ideaId?: string;
  options?: AudienceAnalysisOptions;
}

interface AnalyzeAudienceResponse {
  analysis: AudienceAnalysisResult;
  ideaId?: string;
  profileUpdated: boolean;
}

/**
 * Lambda handler for audience analysis
 * POST /content/analyze-audience
 * 
 * Requirements:
 * - 2.1: Identify target demographic characteristics
 * - 2.4: Provide confidence scores for analysis results
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Audience analysis request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let requestData: AnalyzeAudienceRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate request - either text or ideaId must be provided
    if (!requestData.text && !requestData.ideaId) {
      return createErrorResponse('Either text or ideaId must be provided', 400);
    }

    let textToAnalyze: string;
    let contentIdea: ContentIdea | null = null;

    // Get text from either direct input or content idea
    if (requestData.ideaId) {
      // Fetch content idea from database
      contentIdea = await contentIdeaService.getContentIdea(requestData.ideaId, userId);
      
      if (!contentIdea) {
        return createErrorResponse('Content idea not found', 404);
      }

      textToAnalyze = contentIdea.content;
      
      logInfo('Analyzing audience for existing content idea', {
        userId,
        ideaId: requestData.ideaId,
        textLength: textToAnalyze.length,
      });
    } else {
      textToAnalyze = requestData.text!;
      
      logInfo('Analyzing audience for provided text', {
        userId,
        textLength: textToAnalyze.length,
      });
    }

    // Validate text content
    if (!textToAnalyze || textToAnalyze.trim().length === 0) {
      return createErrorResponse('Text content cannot be empty', 400);
    }

    if (textToAnalyze.length > 5000) {
      logInfo('Text length exceeds limit, will be truncated', {
        originalLength: textToAnalyze.length,
        userId,
      });
    }

    // Perform audience analysis
    const analysisOptions: AudienceAnalysisOptions = {
      includeHistoricalData: true,
      minConfidence: 0.5,
      maxInsights: 10,
      enableBehaviorPrediction: true,
      ...requestData.options,
    };

    const analysisResult = await audienceAnalysisService.analyzeAudience(
      textToAnalyze,
      userId,
      analysisOptions
    );

    // Update content idea with audience analysis if ideaId was provided
    let profileUpdated = false;
    if (requestData.ideaId && contentIdea) {
      try {
        // Update content idea with audience information
        await contentIdeaService.updateContentIdea(requestData.ideaId, userId, {
          targetAudience: {
            profileId: `temp_${Date.now()}`, // Temporary ID, will be replaced when profile is created
            userId,
            demographics: analysisResult.demographics,
            behaviorPatterns: analysisResult.behaviorPatterns,
            updatedAt: new Date().toISOString(),
          },
          confidenceScore: analysisResult.confidenceScore,
        });

        logInfo('Content idea updated with audience analysis', {
          userId,
          ideaId: requestData.ideaId,
          confidenceScore: analysisResult.confidenceScore,
        });
      } catch (error) {
        logError('Failed to update content idea with audience analysis', {
          error: error instanceof Error ? error.message : String(error),
          userId,
          ideaId: requestData.ideaId,
        });
        // Don't fail the entire request if update fails
      }
    }

    // Create or update user's audience profile
    try {
      await audienceAnalysisService.createOrUpdateAudienceProfile(userId, analysisResult);
      profileUpdated = true;
      
      logInfo('User audience profile updated', {
        userId,
        confidenceScore: analysisResult.confidenceScore,
      });
    } catch (error) {
      logError('Failed to update user audience profile', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      // Don't fail the entire request if profile update fails
    }

    // Prepare response
    const response: AnalyzeAudienceResponse = {
      analysis: analysisResult,
      ideaId: requestData.ideaId,
      profileUpdated,
    };

    logInfo('Audience analysis completed successfully', {
      userId,
      ideaId: requestData.ideaId,
      confidenceScore: analysisResult.confidenceScore,
      processingTime: analysisResult.processingTime,
      insightsGenerated: analysisResult.insights.length,
      recommendedPlatforms: analysisResult.recommendedPlatforms.length,
      profileUpdated,
    });

    return createSuccessResponse(response, 200);

  } catch (error) {
    logError('Audience analysis failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};

/**
 * Get user's audience profile
 * GET /content/audience-profile
 */
export const getAudienceProfileHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Get audience profile request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Get user's audience profiles
    const { audienceProfileService } = await import('../../services/database');
    const profiles = await audienceProfileService.getUserAudienceProfiles(userId, 1);

    if (profiles.length === 0) {
      return createErrorResponse('No audience profile found', 404);
    }

    const profile = profiles[0];

    logInfo('Audience profile retrieved successfully', {
      userId,
      profileId: profile.profileId,
      lastUpdated: profile.updatedAt,
    });

    return createSuccessResponse(profile, 200);

  } catch (error) {
    logError('Get audience profile failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};

/**
 * Update user's audience profile
 * PUT /content/audience-profile
 */
export const updateAudienceProfileHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Update audience profile request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'PUT') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let updateData: Partial<{
      demographics: any;
      behaviorPatterns: any;
    }>;
    
    try {
      updateData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Get existing profile
    const { audienceProfileService } = await import('../../services/database');
    const { getCurrentTimestamp } = await import('../../utils');
    const profiles = await audienceProfileService.getUserAudienceProfiles(userId, 1);

    if (profiles.length === 0) {
      return createErrorResponse('No audience profile found to update', 404);
    }

    const existingProfile = profiles[0];

    // Update profile
    const updatedProfile = await audienceProfileService.updateAudienceProfile(
      existingProfile.profileId,
      userId,
      {
        ...updateData,
        updatedAt: getCurrentTimestamp(),
      }
    );

    logInfo('Audience profile updated successfully', {
      userId,
      profileId: existingProfile.profileId,
    });

    return createSuccessResponse(updatedProfile, 200);

  } catch (error) {
    logError('Update audience profile failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};

/**
 * Get user's audience profile history
 * GET /content/audience-profile/history
 */
export const getAudienceProfileHistoryHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Get audience profile history request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Get limit from query parameters
    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit, 10) 
      : 5;

    if (limit < 1 || limit > 20) {
      return createErrorResponse('Limit must be between 1 and 20', 400);
    }

    // Get user's audience profile history
    const profileHistory = await audienceAnalysisService.getAudienceProfileHistory(userId, limit);

    logInfo('Audience profile history retrieved successfully', {
      userId,
      historyCount: profileHistory.length,
      limit,
    });

    return createSuccessResponse({
      profiles: profileHistory,
      count: profileHistory.length,
      userId,
    }, 200);

  } catch (error) {
    logError('Get audience profile history failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};

/**
 * Update specific audience profile field
 * PATCH /content/audience-profile/{field}
 */
export const updateAudienceProfileFieldHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Update audience profile field request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      requestId: event.requestContext.requestId,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'PATCH') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let userId: string;
    try {
      const decoded = verifyJWT(token);
      userId = decoded.userId;
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Get field from path parameters
    const field = event.pathParameters?.field;
    if (!field || !['demographics', 'behaviorPatterns'].includes(field)) {
      return createErrorResponse('Invalid field. Must be "demographics" or "behaviorPatterns"', 400);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let updateData: any;
    try {
      updateData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate update data based on field
    if (field === 'demographics') {
      const validDemographicFields = ['ageRange', 'location', 'interests', 'gender', 'income', 'education'];
      const invalidFields = Object.keys(updateData).filter(key => !validDemographicFields.includes(key));
      if (invalidFields.length > 0) {
        return createErrorResponse(`Invalid demographic fields: ${invalidFields.join(', ')}`, 400);
      }
    } else if (field === 'behaviorPatterns') {
      const validBehaviorFields = ['preferredContentTypes', 'engagementTimes', 'platformUsage'];
      const invalidFields = Object.keys(updateData).filter(key => !validBehaviorFields.includes(key));
      if (invalidFields.length > 0) {
        return createErrorResponse(`Invalid behavior pattern fields: ${invalidFields.join(', ')}`, 400);
      }
    }

    // Update the profile field
    const updatedProfile = await audienceAnalysisService.updateAudienceProfileField(
      userId,
      field as 'demographics' | 'behaviorPatterns',
      updateData
    );

    logInfo('Audience profile field updated successfully', {
      userId,
      profileId: updatedProfile.profileId,
      field,
      updatedFields: Object.keys(updateData),
    });

    return createSuccessResponse({
      profile: updatedProfile,
      updatedField: field,
      updatedAt: updatedProfile.updatedAt,
    }, 200);

  } catch (error) {
    logError('Update audience profile field failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    return handleLambdaError(error);
  }
};
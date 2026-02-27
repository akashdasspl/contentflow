// Lambda function for platform-specific content optimization

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { platformOptimizationService } from '../../services/platform-optimization';
import { generatedContentService, userService, audienceProfileService } from '../../services/database';
import {
  createSuccessResponse,
  createErrorResponse,
  validateRequired,
  validatePlatform,
  validateContentType,
  extractTokenFromEvent,
  verifyJWT,
  handleLambdaError,
  logInfo,
  logError,
} from '../../utils';
import {
  Platform,
  ContentType,
  GeneratedContent,
  UserPreferences,
  AudienceProfile,
  ContentCustomizationOptions,
} from '../../types';

interface OptimizeContentRequest {
  contentId: string;
  targetPlatform?: Platform;
  seoKeywords?: string[];
  enforceConstraints?: boolean;
  customizationOptions?: ContentCustomizationOptions;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logInfo('Platform optimization request received', {
    httpMethod: event.httpMethod,
    path: event.path,
  });

  try {
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

    let requestData: OptimizeContentRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate required fields
    const validationErrors = validateRequired(requestData, ['contentId']);
    if (validationErrors.length > 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString(),
      }, 400);
    }

    // Validate platform if provided
    if (requestData.targetPlatform && !validatePlatform(requestData.targetPlatform)) {
      return createErrorResponse('Invalid target platform', 400);
    }

    logInfo('Optimizing content for platform', {
      userId,
      contentId: requestData.contentId,
      targetPlatform: requestData.targetPlatform,
    });

    // Retrieve the content to optimize
    const content = await generatedContentService.getGeneratedContent(requestData.contentId);
    if (!content) {
      return createErrorResponse('Content not found', 404);
    }

    // Verify content ownership
    if (content.userId !== userId) {
      return createErrorResponse('Access denied', 403);
    }

    // Retrieve user preferences and audience profile
    const [userProfile, audienceProfile] = await Promise.all([
      userService.getUserById(userId),
      audienceProfileService.getUserAudienceProfiles(userId, 1).then(profiles => profiles[0] || null),
    ]);

    // Prepare optimization options
    const optimizationOptions = {
      content,
      targetPlatform: requestData.targetPlatform,
      userPreferences: userProfile?.preferences,
      audience: audienceProfile,
      customizationOptions: requestData.customizationOptions,
      seoKeywords: requestData.seoKeywords,
      enforceConstraints: requestData.enforceConstraints ?? true,
    };

    // Perform platform optimization
    const optimizedContent = await platformOptimizationService.optimizeForPlatform(optimizationOptions);

    // Update the content in the database
    await generatedContentService.updateGeneratedContent(optimizedContent.contentId, optimizedContent.version, {
      generatedText: optimizedContent.generatedText,
      metadata: optimizedContent.metadata,
      platform: optimizedContent.platform,
      version: optimizedContent.version + 1,
      status: optimizedContent.status,
    });

    logInfo('Content optimization completed successfully', {
      userId,
      contentId: optimizedContent.contentId,
      platform: optimizedContent.platform,
      optimizationApplied: optimizedContent.metadata.platformOptimized,
    });

    return createSuccessResponse({
      contentId: optimizedContent.contentId,
      optimizedContent: optimizedContent.generatedText,
      platform: optimizedContent.platform,
      metadata: optimizedContent.metadata,
      optimizationApplied: optimizedContent.metadata.platformOptimized,
      processingTime: Date.now() - parseInt(event.requestContext.requestTimeEpoch?.toString() || '0'),
    });

  } catch (error) {
    logError('Platform optimization failed', error);
    return handleLambdaError(error);
  }
};
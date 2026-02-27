// Lambda function for content generation using platform-specific generators

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { generatePlatformContent, generateContentWithVariations } from '../../services/content-generators';
import { learningIntegrationService } from '../../services/learning-integration';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  handleLambdaError,
  validateRequired,
  validateContentType,
  validateContentIntent,
  validatePlatform,
  logInfo,
  logError,
} from '../../utils';
import { 
  ContentGenerationRequest,
  ContentGenerationResponse,
  ContentType,
  Platform,
  ContentIntent,
} from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Content generation request received', {
      path: event.path,
      method: event.httpMethod,
      requestId: event.requestContext.requestId,
    });

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let requestData: ContentGenerationRequest;
    try {
      requestData = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate required fields
    const validationErrors = validateRequired(requestData, [
      'userId',
      'contentIdea',
      'targetPlatforms',
      'contentTypes',
    ]);

    if (validationErrors.length > 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString(),
      }, 400);
    }

    // Validate content types and platforms
    for (const contentType of requestData.contentTypes) {
      if (!validateContentType(contentType)) {
        return createErrorResponse(`Invalid content type: ${contentType}`, 400);
      }
    }

    for (const platform of requestData.targetPlatforms) {
      if (!validatePlatform(platform)) {
        return createErrorResponse(`Invalid platform: ${platform}`, 400);
      }
    }

    // Validate content idea length
    if (!requestData.contentIdea || requestData.contentIdea.length > 500) {
      return createErrorResponse('Content idea must be between 1 and 500 characters', 400);
    }

    const startTime = Date.now();
    const generatedContent = [];
    const allVariations = [];
    const errors = [];

    // Determine if variations should be generated
    const shouldGenerateVariations = requestData.variationCount && requestData.variationCount > 1;

    // Generate content for each combination of content type and platform
    for (const contentType of requestData.contentTypes) {
      for (const platform of requestData.targetPlatforms) {
        try {
          // Determine appropriate intent (default to informational)
          const intent: ContentIntent = requestData.preferences?.brandVoice?.includes('promotional') 
            ? 'promotional' 
            : contentType === 'script' 
              ? 'educational' 
              : contentType === 'caption' 
                ? 'entertainment' 
                : 'informational';

          const options = {
            contentIdea: requestData.contentIdea,
            userId: requestData.userId,
            platform: platform as Platform,
            intent,
            audience: null, // TODO: Fetch from user's audience profile
            preferences: requestData.preferences || null,
            customizationOptions: requestData.customizationOptions,
            variationCount: requestData.variationCount || 1,
          };

          logInfo('Applying learned preferences to content generation', {
            userId: requestData.userId,
            contentType,
            platform,
          });

          // Apply learned preferences to enhance content generation
          const enhancedOptions = await learningIntegrationService.applyLearnedPreferences(
            requestData.userId,
            options,
            platform as Platform,
            contentType as ContentType
          );

          // Merge enhanced options with original options
          const finalOptions = {
            ...options,
            ...enhancedOptions.optimizedParameters,
            preferences: enhancedOptions.enhancedPreferences || options.preferences,
            customizationOptions: {
              ...options.customizationOptions,
              ...enhancedOptions.platformSpecific,
            },
          };

          logInfo('Generating content with enhanced options', {
            userId: requestData.userId,
            contentType,
            platform,
            intent,
            shouldGenerateVariations,
            variationCount: requestData.variationCount,
            learningApplied: enhancedOptions.learningMetadata?.modelUsed || false,
            confidenceScore: enhancedOptions.learningMetadata?.confidenceScore || 0,
          });

          if (shouldGenerateVariations) {
            // Generate content with variations
            const result = await generateContentWithVariations(contentType as ContentType, finalOptions);
            generatedContent.push(result.primaryContent);
            allVariations.push(...result.variations);
          } else {
            // Generate single content piece
            const result = await generatePlatformContent(contentType as ContentType, finalOptions);
            generatedContent.push(result);
          }

        } catch (error) {
          logError(`Failed to generate ${contentType} for ${platform}`, error);
          errors.push(`Failed to generate ${contentType} for ${platform}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    const processingTime = Date.now() - startTime;

    const response: ContentGenerationResponse = {
      requestId: event.requestContext.requestId,
      generatedContent,
      variations: allVariations.length > 0 ? allVariations : undefined,
      processingTime,
      status: errors.length === 0 ? 'success' : generatedContent.length > 0 ? 'partial' : 'failed',
      errors: errors.length > 0 ? errors : undefined,
    };

    logInfo('Content generation completed', {
      userId: requestData.userId,
      contentCount: generatedContent.length,
      variationCount: allVariations.length,
      processingTime,
      status: response.status,
    });

    return createSuccessResponse(response);

  } catch (error) {
    logError('Content generation handler error', error);
    return handleLambdaError(error);
  }
};
// Lambda function for theme and topic extraction
// Requirements: 1.2

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  extractTokenFromEvent,
  verifyJWT,
  validateRequired,
  handleLambdaError,
  logInfo,
  logError,
  measureExecutionTime,
} from '../../utils';
import { contentIdeaService } from '../../services/database';
import { themeExtractionService, ThemeExtractionOptions } from '../../services/theme-extraction';
import { ValidationError } from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Theme extraction request received', {
      httpMethod: event.httpMethod,
      path: event.path,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'POST') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and validate JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    let decodedToken;
    try {
      decodedToken = verifyJWT(token);
    } catch (error) {
      logError('Token validation failed', error);
      return createErrorResponse('Invalid or expired token', 401);
    }

    const userId = decodedToken.userId;
    if (!userId) {
      return createErrorResponse('Invalid token: missing user ID', 401);
    }

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      logError('Failed to parse request body', error);
      return createErrorResponse('Invalid JSON in request body', 400);
    }

    // Validate request - can extract themes from text directly or from existing content idea
    const { text, ideaId, options } = requestBody;

    if (!text && !ideaId) {
      const validationError: ValidationError = {
        code: 'VALIDATION_ERROR',
        message: 'Either text or ideaId must be provided',
        field: 'text|ideaId',
        value: { text, ideaId },
        constraint: 'oneRequired',
        timestamp: new Date().toISOString(),
      };
      
      return createErrorResponse(validationError, 400);
    }

    let contentText = text;
    let contentIdeaId = ideaId;

    // If ideaId is provided, fetch the content idea
    if (ideaId && !text) {
      try {
        const contentIdea = await contentIdeaService.getContentIdea(ideaId, userId);
        if (!contentIdea) {
          return createErrorResponse('Content idea not found', 404);
        }
        contentText = contentIdea.content;
        contentIdeaId = contentIdea.ideaId;
      } catch (error) {
        logError('Failed to fetch content idea', error);
        return createErrorResponse('Failed to fetch content idea', 500);
      }
    }

    // Validate content text
    if (!contentText || contentText.trim().length === 0) {
      const validationError: ValidationError = {
        code: 'VALIDATION_ERROR',
        message: 'Content text cannot be empty',
        field: 'text',
        value: contentText,
        constraint: 'notEmpty',
        timestamp: new Date().toISOString(),
      };
      
      return createErrorResponse(validationError, 400);
    }

    // Parse extraction options
    const extractionOptions: ThemeExtractionOptions = {
      maxThemes: options?.maxThemes || 10,
      maxTopics: options?.maxTopics || 15,
      minConfidence: options?.minConfidence || 0.5,
      enableSentimentAnalysis: options?.enableSentimentAnalysis !== false,
      enableEntityExtraction: options?.enableEntityExtraction !== false,
    };

    // Validate options
    if (extractionOptions.maxThemes && (extractionOptions.maxThemes < 1 || extractionOptions.maxThemes > 50)) {
      return createErrorResponse('maxThemes must be between 1 and 50', 400);
    }

    if (extractionOptions.maxTopics && (extractionOptions.maxTopics < 1 || extractionOptions.maxTopics > 100)) {
      return createErrorResponse('maxTopics must be between 1 and 100', 400);
    }

    if (extractionOptions.minConfidence && (extractionOptions.minConfidence < 0 || extractionOptions.minConfidence > 1)) {
      return createErrorResponse('minConfidence must be between 0 and 1', 400);
    }

    // Perform theme extraction with performance measurement
    const { result: extractionResult, executionTime } = await measureExecutionTime(
      () => themeExtractionService.extractThemesAndTopics(contentText, extractionOptions),
      'theme-extraction'
    );

    // Check if processing time meets requirement (5 seconds - Requirement 1.2)
    if (extractionResult.processingTime > 5000) {
      logError('Theme extraction exceeded 5-second requirement', {
        processingTime: extractionResult.processingTime,
        textLength: contentText.length,
        userId,
      });
    }

    // If we have a content idea ID, update it with the extracted themes
    if (contentIdeaId) {
      try {
        await themeExtractionService.updateContentIdeaWithThemes(
          contentIdeaId,
          userId,
          extractionResult
        );
        logInfo('Content idea updated with extracted themes', {
          ideaId: contentIdeaId,
          userId,
          themesCount: extractionResult.themes.length,
        });
      } catch (error) {
        logError('Failed to update content idea with themes', error);
        // Don't fail the request if update fails, just log the error
      }
    }

    // Prepare response data
    const responseData = {
      themes: extractionResult.themes,
      topics: extractionResult.topics,
      entities: extractionResult.entities,
      keyPhrases: extractionResult.keyPhrases,
      sentiment: extractionResult.sentiment,
      intent: extractionResult.intent,
      confidence: extractionResult.overallConfidence,
      processingTime: extractionResult.processingTime,
      metadata: {
        textLength: contentText.length,
        options: extractionOptions,
        ideaId: contentIdeaId,
      },
    };

    logInfo('Theme extraction completed successfully', {
      userId,
      ideaId: contentIdeaId,
      themesCount: extractionResult.themes.length,
      topicsCount: extractionResult.topics.length,
      processingTime: extractionResult.processingTime,
      confidence: extractionResult.overallConfidence,
    });

    return createSuccessResponse(responseData, 200);

  } catch (error) {
    logError('Unexpected error in theme extraction', error);
    return handleLambdaError(error);
  }
};
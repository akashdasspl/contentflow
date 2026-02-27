// Lambda function for content idea submission and validation
// Requirements: 1.1, 1.4

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  extractTokenFromEvent,
  verifyJWT,
  validateRequired,
  validateContentLength,
  generateIdeaId,
  getCurrentTimestamp,
  handleLambdaError,
  logInfo,
  logError,
} from '../../utils';
import { contentIdeaService } from '../../services/database';
import { themeExtractionService } from '../../services/theme-extraction';
import { ContentIdea, ValidationError } from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Content idea submission request received', {
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

    // Validate required fields
    const requiredFields = ['content'];
    const validationErrors = validateRequired(requestBody, requiredFields);

    if (validationErrors.length > 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Required fields are missing',
        details: { errors: validationErrors },
        timestamp: getCurrentTimestamp(),
      }, 400);
    }

    const { content } = requestBody;

    // Validate content is not empty after trimming (check before length validation)
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      const validationError: ValidationError = {
        code: 'VALIDATION_ERROR',
        message: 'Content cannot be empty',
        field: 'content',
        value: content,
        constraint: 'notEmpty',
        timestamp: getCurrentTimestamp(),
      };
      
      return createErrorResponse(validationError, 400);
    }

    // Validate content length (500 character limit - Requirement 1.1)
    if (!validateContentLength(content, 500)) {
      const validationError: ValidationError = {
        code: 'VALIDATION_ERROR',
        message: 'Content exceeds maximum length of 500 characters',
        field: 'content',
        value: content,
        constraint: 'maxLength:500',
        timestamp: getCurrentTimestamp(),
      };
      
      return createErrorResponse(validationError, 400);
    }

    // Create content idea object
    const ideaId = generateIdeaId();
    const timestamp = getCurrentTimestamp();

    const contentIdea: ContentIdea = {
      ideaId,
      userId,
      content: trimmedContent,
      extractedThemes: [], // Will be populated by theme extraction service
      targetAudience: {
        profileId: '',
        userId,
        demographics: {
          ageRange: '',
          location: '',
          interests: [],
        },
        behaviorPatterns: {
          preferredContentTypes: [],
          engagementTimes: [],
          platformUsage: {
            blog: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
            twitter: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
            facebook: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
            instagram: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
            linkedin: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
            youtube: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
            tiktok: { frequency: '', engagementRate: 0, preferredContentLength: '', bestPostingTimes: [] },
          },
        },
        updatedAt: timestamp,
      },
      intent: 'informational', // Default intent, will be updated by analysis service
      confidenceScore: 0, // Will be updated by analysis service
      createdAt: timestamp,
    };

    // Store content idea in DynamoDB (Requirement 1.4)
    try {
      await contentIdeaService.createContentIdea(contentIdea);
      logInfo('Content idea stored successfully', {
        ideaId,
        userId,
        contentLength: trimmedContent.length,
      });
    } catch (error) {
      logError('Failed to store content idea', error);
      return createErrorResponse('Failed to store content idea', 500);
    }

    // Extract themes and topics asynchronously (Requirement 1.2)
    try {
      const extractionResult = await themeExtractionService.extractThemesAndTopics(trimmedContent, {
        maxThemes: 10,
        maxTopics: 15,
        minConfidence: 0.5,
        enableSentimentAnalysis: true,
        enableEntityExtraction: true,
      });

      // Update the content idea with extracted themes
      await themeExtractionService.updateContentIdeaWithThemes(ideaId, userId, extractionResult);

      logInfo('Theme extraction completed for content idea', {
        ideaId,
        userId,
        themesCount: extractionResult.themes.length,
        intent: extractionResult.intent,
        confidence: extractionResult.overallConfidence,
        processingTime: extractionResult.processingTime,
      });

      // Include extraction results in response
      const responseData = {
        ideaId,
        content: trimmedContent,
        themes: extractionResult.themes,
        topics: extractionResult.topics,
        intent: extractionResult.intent,
        confidence: extractionResult.overallConfidence,
        processingTime: extractionResult.processingTime,
        createdAt: timestamp,
        message: 'Content idea submitted and analyzed successfully',
      };

      return createSuccessResponse(responseData, 201);

    } catch (themeError) {
      logError('Theme extraction failed, but content idea was saved', themeError);
      
      // Return success response even if theme extraction fails
      const responseData = {
        ideaId,
        content: trimmedContent,
        themes: [],
        topics: [],
        intent: 'informational',
        confidence: 0,
        processingTime: 0,
        createdAt: timestamp,
        message: 'Content idea submitted successfully (theme analysis pending)',
        warning: 'Theme extraction failed but will be retried',
      };

      return createSuccessResponse(responseData, 201);
    }

  } catch (error) {
    logError('Unexpected error in content idea submission', error);
    return handleLambdaError(error);
  }
};
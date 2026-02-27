// Lambda function for updating a content idea
// Requirements: 1.1, 1.4

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  extractTokenFromEvent,
  verifyJWT,
  validateContentLength,
  getCurrentTimestamp,
  handleLambdaError,
  logInfo,
  logError,
} from '../../utils';
import { contentIdeaService } from '../../services/database';
import { ValidationError } from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Update content idea request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'PUT') {
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

    // Extract idea ID from path parameters
    const pathParameters = event.pathParameters;
    if (!pathParameters || !pathParameters.ideaId) {
      return createErrorResponse('Idea ID is required in path', 400);
    }

    const ideaId = pathParameters.ideaId;

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

    // Check if content idea exists and belongs to user
    try {
      const existingIdea = await contentIdeaService.getContentIdea(ideaId, userId);
      if (!existingIdea) {
        return createErrorResponse('Content idea not found', 404);
      }
    } catch (error) {
      logError('Failed to check existing content idea', error);
      return createErrorResponse('Failed to verify content idea', 500);
    }

    // Validate updates
    const updates: any = {};

    if (requestBody.content !== undefined) {
      const content = requestBody.content;
      
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

      // Validate content is not empty after trimming
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

      updates.content = trimmedContent;
    }

    // Add other updatable fields if provided
    if (requestBody.extractedThemes !== undefined) {
      updates.extractedThemes = requestBody.extractedThemes;
    }

    if (requestBody.intent !== undefined) {
      updates.intent = requestBody.intent;
    }

    if (requestBody.confidenceScore !== undefined) {
      updates.confidenceScore = requestBody.confidenceScore;
    }

    if (requestBody.targetAudience !== undefined) {
      updates.targetAudience = requestBody.targetAudience;
    }

    // If no valid updates provided
    if (Object.keys(updates).length === 0) {
      return createErrorResponse('No valid updates provided', 400);
    }

    // Update content idea in DynamoDB
    try {
      const updatedIdea = await contentIdeaService.updateContentIdea(ideaId, userId, updates);
      
      logInfo('Content idea updated successfully', {
        ideaId,
        userId,
        updatedFields: Object.keys(updates),
      });

      // Return success response with updated content idea
      return createSuccessResponse(updatedIdea, 200);

    } catch (error) {
      logError('Failed to update content idea', error);
      return createErrorResponse('Failed to update content idea', 500);
    }

  } catch (error) {
    logError('Unexpected error in update content idea', error);
    return handleLambdaError(error);
  }
};
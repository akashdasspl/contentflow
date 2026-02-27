// Lambda function for deleting a content idea
// Requirements: 1.4

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  extractTokenFromEvent,
  verifyJWT,
  handleLambdaError,
  logInfo,
  logError,
} from '../../utils';
import { contentIdeaService } from '../../services/database';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Delete content idea request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'DELETE') {
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

    // Delete content idea from DynamoDB
    try {
      await contentIdeaService.deleteContentIdea(ideaId, userId);
      
      logInfo('Content idea deleted successfully', {
        ideaId,
        userId,
      });

      // Return success response
      const responseData = {
        ideaId,
        message: 'Content idea deleted successfully',
      };

      return createSuccessResponse(responseData, 200);

    } catch (error) {
      logError('Failed to delete content idea', error);
      return createErrorResponse('Failed to delete content idea', 500);
    }

  } catch (error) {
    logError('Unexpected error in delete content idea', error);
    return handleLambdaError(error);
  }
};
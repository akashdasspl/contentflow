// Lambda function for retrieving a specific content idea
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
    logInfo('Get content idea request received', {
      httpMethod: event.httpMethod,
      path: event.path,
      pathParameters: event.pathParameters,
    });

    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
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

    // Retrieve specific content idea from DynamoDB
    try {
      const contentIdea = await contentIdeaService.getContentIdea(ideaId, userId);
      
      if (!contentIdea) {
        logInfo('Content idea not found', { ideaId, userId });
        return createErrorResponse('Content idea not found', 404);
      }

      logInfo('Content idea retrieved successfully', {
        ideaId,
        userId,
      });

      // Return success response with content idea
      return createSuccessResponse(contentIdea, 200);

    } catch (error) {
      logError('Failed to retrieve content idea', error);
      return createErrorResponse('Failed to retrieve content idea', 500);
    }

  } catch (error) {
    logError('Unexpected error in get content idea', error);
    return handleLambdaError(error);
  }
};
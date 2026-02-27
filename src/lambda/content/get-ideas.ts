// Lambda function for retrieving user's content ideas
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
    logInfo('Get content ideas request received', {
      httpMethod: event.httpMethod,
      path: event.path,
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

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : 20;

    // Validate limit parameter
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createErrorResponse('Limit must be a number between 1 and 100', 400);
    }

    // Retrieve user's content ideas from DynamoDB
    try {
      const contentIdeas = await contentIdeaService.getUserContentIdeas(userId, limit);
      
      logInfo('Content ideas retrieved successfully', {
        userId,
        count: contentIdeas.length,
        limit,
      });

      // Return success response with content ideas
      const responseData = {
        ideas: contentIdeas,
        count: contentIdeas.length,
        limit,
        userId,
      };

      return createSuccessResponse(responseData, 200);

    } catch (error) {
      logError('Failed to retrieve content ideas', error);
      return createErrorResponse('Failed to retrieve content ideas', 500);
    }

  } catch (error) {
    logError('Unexpected error in get content ideas', error);
    return handleLambdaError(error);
  }
};
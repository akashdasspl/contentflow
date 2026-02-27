// Get user profile Lambda function
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Get user profile request received', { 
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

    // Get user profile from database
    const userProfile = await userService.getUserById(userId);
    if (!userProfile) {
      return createErrorResponse('User profile not found', 404);
    }

    logInfo('User profile retrieved successfully', { userId });

    // Return profile without sensitive information
    const profileResponse = {
      userId: userProfile.userId,
      email: userProfile.email,
      preferences: userProfile.preferences,
      createdAt: userProfile.createdAt,
      updatedAt: userProfile.updatedAt,
    };

    return createSuccessResponse(profileResponse, 200);

  } catch (error: any) {
    logError('Get profile error', error);
    return handleLambdaError(error);
  }
};
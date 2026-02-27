// Refresh token Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  verifyJWT,
  generateJWT,
  getCurrentTimestamp,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';

interface RefreshTokenRequest {
  refreshToken: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Token refresh request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    const requestBody: RefreshTokenRequest = JSON.parse(event.body);

    if (!requestBody.refreshToken) {
      return createErrorResponse('Refresh token is required', 400);
    }

    try {
      // Verify refresh token
      const decoded = verifyJWT(requestBody.refreshToken);
      
      if (!decoded.userId || !decoded.email || decoded.type !== 'refresh') {
        return createErrorResponse('Invalid refresh token', 401);
      }

      // Verify user still exists and is active
      const userProfile = await userService.getUserById(decoded.userId);
      if (!userProfile) {
        return createErrorResponse('User not found', 401);
      }

      if (userProfile.email !== decoded.email) {
        return createErrorResponse('Token email mismatch', 401);
      }

      // Generate new access token
      const tokenPayload = {
        userId: decoded.userId,
        email: decoded.email,
        iat: Math.floor(Date.now() / 1000),
      };

      const newAccessToken = generateJWT(tokenPayload, '1h');

      logInfo('Access token refreshed successfully', { 
        userId: decoded.userId,
        email: decoded.email 
      });

      // Return new access token
      const responseData = {
        token: newAccessToken,
        expiresIn: 3600, // 1 hour in seconds
        refreshedAt: getCurrentTimestamp(),
      };

      return createSuccessResponse(responseData, 200);

    } catch (jwtError: any) {
      logError('Refresh token validation failed', jwtError);
      
      if (jwtError.message.includes('expired')) {
        return createErrorResponse('Refresh token has expired', 401);
      }
      
      if (jwtError.message.includes('invalid')) {
        return createErrorResponse('Invalid refresh token', 401);
      }
      
      return createErrorResponse('Refresh token validation failed', 401);
    }

  } catch (error: any) {
    logError('Token refresh error', error);
    return handleLambdaError(error);
  }
};
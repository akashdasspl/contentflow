// JWT token validation Lambda function for API Gateway authorizer
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  verifyJWT,
  extractTokenFromEvent,
  getCurrentTimestamp,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Token validation request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Extract token from Authorization header
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token is required', 401);
    }

    try {
      // Verify JWT token
      const decoded = verifyJWT(token);
      
      if (!decoded.userId || !decoded.email) {
        return createErrorResponse('Invalid token payload', 401);
      }

      // Verify user still exists and is active
      const userProfile = await userService.getUserById(decoded.userId);
      if (!userProfile) {
        return createErrorResponse('User not found', 401);
      }

      if (userProfile.email !== decoded.email) {
        return createErrorResponse('Token email mismatch', 401);
      }

      logInfo('Token validated successfully', { 
        userId: decoded.userId,
        email: decoded.email 
      });

      // Return user information for downstream Lambda functions
      const responseData = {
        valid: true,
        userId: decoded.userId,
        email: decoded.email,
        user: userProfile,
        validatedAt: getCurrentTimestamp(),
      };

      return createSuccessResponse(responseData, 200);

    } catch (jwtError: any) {
      logError('JWT validation failed', jwtError);
      
      if (jwtError.message.includes('expired')) {
        return createErrorResponse('Token has expired', 401);
      }
      
      if (jwtError.message.includes('invalid')) {
        return createErrorResponse('Invalid token', 401);
      }
      
      return createErrorResponse('Token validation failed', 401);
    }

  } catch (error: any) {
    logError('Token validation error', error);
    return handleLambdaError(error);
  }
};

// API Gateway Custom Authorizer format (alternative implementation)
export const authorizerHandler = async (event: any): Promise<any> => {
  try {
    const token = event.authorizationToken?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('Unauthorized');
    }

    const decoded = verifyJWT(token);
    
    if (!decoded.userId) {
      throw new Error('Unauthorized');
    }

    // Verify user exists
    const userProfile = await userService.getUserById(decoded.userId);
    if (!userProfile) {
      throw new Error('Unauthorized');
    }

    // Generate policy
    const policy = {
      principalId: decoded.userId,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
      context: {
        userId: decoded.userId,
        email: decoded.email,
      },
    };

    logInfo('API Gateway authorization successful', { 
      userId: decoded.userId,
      resource: event.methodArn 
    });

    return policy;

  } catch (error: any) {
    logError('API Gateway authorization failed', error);
    throw new Error('Unauthorized');
  }
};
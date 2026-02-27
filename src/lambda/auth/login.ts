// User login Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminInitiateAuthCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequired, 
  validateEmail, 
  generateJWT,
  getCurrentTimestamp,
  getEnvVar,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';
import { AuthenticationRequest, AuthenticationResponse } from '../../types';

const cognitoClient = new CognitoIdentityProviderClient({
  region: getEnvVar('AWS_REGION', 'us-east-1'),
});

const USER_POOL_ID = getEnvVar('USER_POOL_ID');
const USER_POOL_CLIENT_ID = getEnvVar('USER_POOL_CLIENT_ID');

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('User login request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    const requestBody: AuthenticationRequest = JSON.parse(event.body);

    // Validate required fields
    const validationErrors = validateRequired(requestBody, ['email', 'password']);
    if (validationErrors.length > 0) {
      return createErrorResponse({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: validationErrors,
        timestamp: getCurrentTimestamp(),
      }, 400);
    }

    // Validate email format
    if (!validateEmail(requestBody.email)) {
      return createErrorResponse('Invalid email format', 400);
    }

    // Get user from database to get userId
    const userProfile = await userService.getUserByEmail(requestBody.email);
    if (!userProfile) {
      return createErrorResponse('Invalid credentials', 401);
    }

    try {
      // Authenticate with Cognito using Admin API
      const authCommand = new AdminInitiateAuthCommand({
        UserPoolId: USER_POOL_ID,
        ClientId: USER_POOL_CLIENT_ID,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: userProfile.userId,
          PASSWORD: requestBody.password,
        },
      });

      const authResult = await cognitoClient.send(authCommand);

      if (!authResult.AuthenticationResult) {
        return createErrorResponse('Authentication failed', 401);
      }

      // Get additional user details from Cognito
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userProfile.userId,
      });

      const cognitoUser = await cognitoClient.send(getUserCommand);

      // Verify user is enabled and confirmed
      if (!cognitoUser.Enabled) {
        return createErrorResponse('User account is disabled', 401);
      }

      if (cognitoUser.UserStatus !== 'CONFIRMED') {
        return createErrorResponse('User account is not confirmed', 401);
      }

      logInfo('User authenticated successfully with Cognito', { 
        userId: userProfile.userId,
        email: requestBody.email 
      });

    } catch (cognitoError: any) {
      logError('Cognito authentication failed', cognitoError);
      
      if (cognitoError.name === 'NotAuthorizedException') {
        return createErrorResponse('Invalid credentials', 401);
      }
      
      if (cognitoError.name === 'UserNotConfirmedException') {
        return createErrorResponse('User account is not confirmed', 401);
      }
      
      if (cognitoError.name === 'UserNotFoundException') {
        return createErrorResponse('Invalid credentials', 401);
      }
      
      if (cognitoError.name === 'TooManyRequestsException') {
        return createErrorResponse('Too many login attempts. Please try again later.', 429);
      }
      
      throw cognitoError;
    }

    // Generate JWT tokens
    const tokenPayload = {
      userId: userProfile.userId,
      email: userProfile.email,
      iat: Math.floor(Date.now() / 1000),
    };

    const accessToken = generateJWT(tokenPayload, '1h');
    const refreshToken = generateJWT(
      { ...tokenPayload, type: 'refresh' }, 
      '30d'
    );

    logInfo('JWT tokens generated successfully', { userId: userProfile.userId });

    // Prepare response
    const authResponse: AuthenticationResponse = {
      token: accessToken,
      refreshToken: refreshToken,
      user: userProfile,
      expiresIn: 3600, // 1 hour in seconds
    };

    return createSuccessResponse(authResponse, 200);

  } catch (error: any) {
    logError('Login error', error);
    return handleLambdaError(error);
  }
};
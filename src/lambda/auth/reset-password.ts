// Password reset Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminSetUserPasswordCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequired, 
  validateEmail,
  getCurrentTimestamp,
  getEnvVar,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';

const cognitoClient = new CognitoIdentityProviderClient({
  region: getEnvVar('AWS_REGION', 'us-east-1'),
});

const USER_POOL_ID = getEnvVar('USER_POOL_ID');

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  confirmationCode?: string; // For future implementation with email verification
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Password reset request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    const requestBody: ResetPasswordRequest = JSON.parse(event.body);

    // Validate required fields
    const validationErrors = validateRequired(requestBody, ['email', 'newPassword']);
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

    // Validate password strength
    if (requestBody.newPassword.length < 8) {
      return createErrorResponse('Password must be at least 8 characters long', 400);
    }

    // Get user from database
    const userProfile = await userService.getUserByEmail(requestBody.email);
    if (!userProfile) {
      // Don't reveal if user exists or not for security
      return createSuccessResponse({
        message: 'If the email exists, password reset instructions have been sent.',
      }, 200);
    }

    try {
      // Verify user exists in Cognito
      const getUserCommand = new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userProfile.userId,
      });

      const cognitoUser = await cognitoClient.send(getUserCommand);

      if (!cognitoUser.Enabled) {
        return createErrorResponse('User account is disabled', 401);
      }

      // Set new password (in production, this would require email verification)
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: userProfile.userId,
        Password: requestBody.newPassword,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);

      logInfo('Password reset successfully', { 
        userId: userProfile.userId,
        email: requestBody.email 
      });

      return createSuccessResponse({
        message: 'Password has been reset successfully.',
        resetAt: getCurrentTimestamp(),
      }, 200);

    } catch (cognitoError: any) {
      logError('Cognito password reset failed', cognitoError);
      
      if (cognitoError.name === 'UserNotFoundException') {
        // Don't reveal if user exists or not for security
        return createSuccessResponse({
          message: 'If the email exists, password reset instructions have been sent.',
        }, 200);
      }
      
      if (cognitoError.name === 'InvalidPasswordException') {
        return createErrorResponse('Password does not meet requirements', 400);
      }
      
      if (cognitoError.name === 'TooManyRequestsException') {
        return createErrorResponse('Too many password reset attempts. Please try again later.', 429);
      }
      
      throw cognitoError;
    }

  } catch (error: any) {
    logError('Password reset error', error);
    return handleLambdaError(error);
  }
};
// User registration Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  validateRequired, 
  validateEmail, 
  generateUserId,
  getCurrentTimestamp,
  getEnvVar,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { userService } from '../../services/database';
import { RegistrationRequest, UserProfile, UserPreferences } from '../../types';

const cognitoClient = new CognitoIdentityProviderClient({
  region: getEnvVar('AWS_REGION', 'us-east-1'),
});

const USER_POOL_ID = getEnvVar('USER_POOL_ID');

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('User registration request received', { 
      path: event.path,
      httpMethod: event.httpMethod 
    });

    // Parse request body
    if (!event.body) {
      return createErrorResponse('Request body is required', 400);
    }

    const requestBody: RegistrationRequest = JSON.parse(event.body);

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

    // Validate password strength
    if (requestBody.password.length < 8) {
      return createErrorResponse('Password must be at least 8 characters long', 400);
    }

    // Check if user already exists
    const existingUser = await userService.getUserByEmail(requestBody.email);
    if (existingUser) {
      return createErrorResponse('User with this email already exists', 409);
    }

    // Generate user ID
    const userId = generateUserId();
    const currentTimestamp = getCurrentTimestamp();

    try {
      // Create user in Cognito
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        UserAttributes: [
          {
            Name: 'email',
            Value: requestBody.email,
          },
          {
            Name: 'email_verified',
            Value: 'true',
          },
        ],
        MessageAction: 'SUPPRESS', // Don't send welcome email
        TemporaryPassword: requestBody.password,
      });

      await cognitoClient.send(createUserCommand);

      // Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
        Password: requestBody.password,
        Permanent: true,
      });

      await cognitoClient.send(setPasswordCommand);

      logInfo('User created in Cognito successfully', { userId, email: requestBody.email });

    } catch (cognitoError: any) {
      logError('Failed to create user in Cognito', cognitoError);
      
      if (cognitoError.name === 'UsernameExistsException') {
        return createErrorResponse('User already exists', 409);
      }
      
      if (cognitoError.name === 'InvalidPasswordException') {
        return createErrorResponse('Password does not meet requirements', 400);
      }
      
      throw cognitoError;
    }

    // Create user profile in DynamoDB
    const defaultPreferences: UserPreferences = {
      brandVoice: 'professional',
      targetAudience: {
        profileId: '',
        userId,
        demographics: {
          ageRange: '25-45',
          location: 'global',
          interests: [],
        },
        behaviorPatterns: {
          preferredContentTypes: ['blog-post'],
          engagementTimes: ['9:00', '17:00'],
          platformUsage: {
            blog: {
              frequency: 'daily',
              engagementRate: 0.05,
              preferredContentLength: 'long',
              bestPostingTimes: ['9:00', '17:00'],
            },
            twitter: {
              frequency: 'never',
              engagementRate: 0,
              preferredContentLength: 'short',
              bestPostingTimes: [],
            },
            facebook: {
              frequency: 'never',
              engagementRate: 0,
              preferredContentLength: 'medium',
              bestPostingTimes: [],
            },
            instagram: {
              frequency: 'never',
              engagementRate: 0,
              preferredContentLength: 'short',
              bestPostingTimes: [],
            },
            linkedin: {
              frequency: 'never',
              engagementRate: 0,
              preferredContentLength: 'medium',
              bestPostingTimes: [],
            },
            youtube: {
              frequency: 'never',
              engagementRate: 0,
              preferredContentLength: 'long',
              bestPostingTimes: [],
            },
            tiktok: {
              frequency: 'never',
              engagementRate: 0,
              preferredContentLength: 'short',
              bestPostingTimes: [],
            },
          },
        },
        updatedAt: currentTimestamp,
      },
      preferredPlatforms: ['blog'],
      contentStyle: 'informative',
    };

    const userProfile: UserProfile = {
      userId,
      email: requestBody.email,
      preferences: requestBody.preferences ? { ...defaultPreferences, ...requestBody.preferences } : defaultPreferences,
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
    };

    await userService.createUser(userProfile);

    logInfo('User profile created successfully', { userId });

    // Return success response (without sensitive data)
    const responseData = {
      userId,
      email: requestBody.email,
      message: 'User registered successfully',
      createdAt: currentTimestamp,
    };

    return createSuccessResponse(responseData, 201);

  } catch (error: any) {
    logError('Registration error', error);
    return handleLambdaError(error);
  }
};
// Delete user profile Lambda function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  extractTokenFromEvent,
  verifyJWT,
  getCurrentTimestamp,
  getEnvVar,
  logInfo,
  logError,
  handleLambdaError
} from '../../utils';
import { 
  userService, 
  contentIdeaService, 
  generatedContentService, 
  engagementFeedbackService,
  audienceProfileService 
} from '../../services/database';

const cognitoClient = new CognitoIdentityProviderClient({
  region: getEnvVar('AWS_REGION', 'us-east-1'),
});

const USER_POOL_ID = getEnvVar('USER_POOL_ID');

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    logInfo('Delete user profile request received', { 
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

    // Verify user exists
    const userProfile = await userService.getUserById(userId);
    if (!userProfile) {
      return createErrorResponse('User profile not found', 404);
    }

    logInfo('Starting user data deletion process', { userId });

    try {
      // Delete user from Cognito
      const deleteUserCommand = new AdminDeleteUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      });

      await cognitoClient.send(deleteUserCommand);
      logInfo('User deleted from Cognito successfully', { userId });

    } catch (cognitoError: any) {
      logError('Failed to delete user from Cognito', cognitoError);
      
      if (cognitoError.name === 'UserNotFoundException') {
        logInfo('User not found in Cognito, continuing with database cleanup', { userId });
      } else {
        throw cognitoError;
      }
    }

    // Delete all user-related data from DynamoDB tables
    try {
      // Get all user's content ideas
      const contentIdeas = await contentIdeaService.getUserContentIdeas(userId);
      
      // Delete all generated content for each idea
      for (const idea of contentIdeas) {
        const generatedContent = await generatedContentService.getContentByIdea(idea.ideaId);
        for (const content of generatedContent) {
          await generatedContentService.deleteGeneratedContent(content.contentId, content.version);
        }
        
        // Delete the content idea
        await contentIdeaService.deleteContentIdea(idea.ideaId, userId);
      }

      // Get and delete all user's engagement feedback
      const feedbackData = await engagementFeedbackService.getUserFeedback(userId);
      for (const feedback of feedbackData) {
        await engagementFeedbackService.deleteFeedback(feedback.feedbackId, feedback.timestamp);
      }

      // Get and delete all user's audience profiles
      const audienceProfiles = await audienceProfileService.getUserAudienceProfiles(userId);
      for (const profile of audienceProfiles) {
        await audienceProfileService.deleteAudienceProfile(profile.profileId, userId);
      }

      // Finally, delete the user profile
      await userService.deleteUser(userId);

      logInfo('All user data deleted successfully from database', { 
        userId,
        deletedContentIdeas: contentIdeas.length,
        deletedFeedback: feedbackData.length,
        deletedAudienceProfiles: audienceProfiles.length
      });

    } catch (dbError: any) {
      logError('Failed to delete user data from database', dbError);
      throw dbError;
    }

    // Return success response
    const responseData = {
      message: 'User profile and all associated data have been permanently deleted',
      userId,
      deletedAt: getCurrentTimestamp(),
    };

    return createSuccessResponse(responseData, 200);

  } catch (error: any) {
    logError('Delete profile error', error);
    return handleLambdaError(error);
  }
};
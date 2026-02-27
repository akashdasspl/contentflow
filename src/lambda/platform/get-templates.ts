// Lambda function for retrieving platform templates

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { platformOptimizationService } from '../../services/platform-optimization';
import {
  createSuccessResponse,
  createErrorResponse,
  validatePlatform,
  extractTokenFromEvent,
  verifyJWT,
  handleLambdaError,
  logInfo,
  logError,
} from '../../utils';
import { Platform } from '../../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logInfo('Platform templates request received', {
    httpMethod: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters,
  });

  try {
    // Validate HTTP method
    if (event.httpMethod !== 'GET') {
      return createErrorResponse('Method not allowed', 405);
    }

    // Extract and verify JWT token
    const token = extractTokenFromEvent(event);
    if (!token) {
      return createErrorResponse('Authorization token required', 401);
    }

    try {
      verifyJWT(token);
    } catch (error) {
      return createErrorResponse('Invalid or expired token', 401);
    }

    // Get query parameters
    const platform = event.queryStringParameters?.platform as Platform;
    const templateId = event.queryStringParameters?.templateId;

    // If specific template ID is requested
    if (templateId) {
      logInfo('Retrieving specific template', { templateId });
      
      const template = await platformOptimizationService.getPlatformTemplate(templateId);
      if (!template) {
        return createErrorResponse('Template not found', 404);
      }

      return createSuccessResponse({
        template,
      });
    }

    // If platform is specified, get templates for that platform
    if (platform) {
      if (!validatePlatform(platform)) {
        return createErrorResponse('Invalid platform', 400);
      }

      logInfo('Retrieving templates for platform', { platform });
      
      const templates = await platformOptimizationService.getPlatformTemplates(platform);
      
      return createSuccessResponse({
        platform,
        templates,
        count: templates.length,
      });
    }

    // Get all templates
    logInfo('Retrieving all platform templates');
    
    const allPlatforms: Platform[] = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
    const templatesByPlatform: Record<string, any[]> = {};
    
    for (const platformName of allPlatforms) {
      const templates = await platformOptimizationService.getPlatformTemplates(platformName);
      if (templates.length > 0) {
        templatesByPlatform[platformName] = templates;
      }
    }

    const totalTemplates = Object.values(templatesByPlatform).reduce((sum, templates) => sum + templates.length, 0);

    return createSuccessResponse({
      templatesByPlatform,
      totalTemplates,
      availablePlatforms: Object.keys(templatesByPlatform),
    });

  } catch (error) {
    logError('Failed to retrieve platform templates', error);
    return handleLambdaError(error);
  }
};
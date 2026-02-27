// Lambda function for retrieving platform-specific guidelines

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
  logInfo('Platform guidelines request received', {
    httpMethod: event.httpMethod,
    path: event.path,
    pathParameters: event.pathParameters,
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

    // Get platform from path parameters
    const platform = event.pathParameters?.platform as Platform;
    if (!platform) {
      return createErrorResponse('Platform parameter is required', 400);
    }

    // Validate platform
    if (!validatePlatform(platform)) {
      return createErrorResponse('Invalid platform', 400);
    }

    logInfo('Retrieving guidelines for platform', { platform });

    // Get platform guidelines
    const guidelines = await platformOptimizationService.getPlatformGuidelines(platform);

    // Add additional platform-specific information
    const platformInfo = getPlatformInfo(platform);

    return createSuccessResponse({
      platform,
      guidelines: {
        ...guidelines,
        platformInfo,
      },
      retrievedAt: new Date().toISOString(),
    });

  } catch (error) {
    logError('Failed to retrieve platform guidelines', error);
    return handleLambdaError(error);
  }
};

/**
 * Get additional platform-specific information
 */
function getPlatformInfo(platform: Platform): {
  name: string;
  description: string;
  audience: string;
  contentTypes: string[];
  optimalPostingTimes: string[];
  keyFeatures: string[];
} {
  const platformData: Record<Platform, any> = {
    blog: {
      name: 'Blog',
      description: 'Long-form content platform for detailed articles and thought leadership',
      audience: 'Readers seeking in-depth information and expertise',
      contentTypes: ['Articles', 'Tutorials', 'Case studies', 'Opinion pieces'],
      optimalPostingTimes: ['Tuesday-Thursday 10AM-2PM'],
      keyFeatures: ['SEO optimization', 'Long-form content', 'Internal linking', 'Rich media support'],
    },
    twitter: {
      name: 'Twitter',
      description: 'Microblogging platform for real-time updates and conversations',
      audience: 'Users seeking quick updates, news, and engaging conversations',
      contentTypes: ['Tweets', 'Threads', 'Replies', 'Retweets'],
      optimalPostingTimes: ['Monday-Friday 9AM-3PM', 'Wednesday 9AM-3PM (peak)'],
      keyFeatures: ['Character limit (280)', 'Real-time engagement', 'Hashtags', 'Mentions'],
    },
    facebook: {
      name: 'Facebook',
      description: 'Social networking platform for community building and sharing',
      audience: 'Diverse audience across all age groups, community-focused',
      contentTypes: ['Posts', 'Stories', 'Videos', 'Events'],
      optimalPostingTimes: ['Tuesday-Thursday 1PM-3PM', 'Wednesday-Friday 1PM-4PM'],
      keyFeatures: ['Community building', 'Rich media', 'Events', 'Groups'],
    },
    instagram: {
      name: 'Instagram',
      description: 'Visual-first platform for photo and video sharing',
      audience: 'Younger demographics, visual content enthusiasts',
      contentTypes: ['Posts', 'Stories', 'Reels', 'IGTV'],
      optimalPostingTimes: ['Monday-Friday 11AM-1PM', 'Tuesday-Friday 10AM-3PM'],
      keyFeatures: ['Visual content', 'Stories', 'Hashtags', 'Influencer marketing'],
    },
    linkedin: {
      name: 'LinkedIn',
      description: 'Professional networking platform for business and career content',
      audience: 'Professionals, business leaders, job seekers',
      contentTypes: ['Posts', 'Articles', 'Videos', 'Documents'],
      optimalPostingTimes: ['Tuesday-Thursday 8AM-10AM', 'Tuesday-Wednesday 12PM-2PM'],
      keyFeatures: ['Professional networking', 'Thought leadership', 'Business content', 'Career focus'],
    },
    youtube: {
      name: 'YouTube',
      description: 'Video sharing platform for entertainment and education',
      audience: 'Global audience seeking video content and tutorials',
      contentTypes: ['Videos', 'Shorts', 'Live streams', 'Playlists'],
      optimalPostingTimes: ['Monday-Wednesday 2PM-4PM', 'Thursday-Friday 12PM-3PM'],
      keyFeatures: ['Video content', 'SEO optimization', 'Monetization', 'Community building'],
    },
    tiktok: {
      name: 'TikTok',
      description: 'Short-form video platform for creative and entertaining content',
      audience: 'Younger demographics, entertainment seekers',
      contentTypes: ['Short videos', 'Duets', 'Challenges', 'Live streams'],
      optimalPostingTimes: ['Tuesday-Thursday 6AM-10AM', 'Monday-Wednesday 7PM-9PM'],
      keyFeatures: ['Short-form video', 'Algorithm-driven', 'Trends', 'Creative tools'],
    },
  };

  return platformData[platform] || {
    name: platform,
    description: 'Platform-specific content optimization',
    audience: 'General audience',
    contentTypes: ['Posts'],
    optimalPostingTimes: ['Varies by platform'],
    keyFeatures: ['Content optimization'],
  };
}
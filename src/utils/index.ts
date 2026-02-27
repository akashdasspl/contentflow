// Utility functions for ContentFlow AI

import { APIGatewayProxyEvent } from 'aws-lambda';
import { APIGatewayResponse, APIError, ValidationError } from '../types';
import * as jwt from 'jsonwebtoken';

// Environment variables
//export const getEnvVar = (name: string, defaultValue?: string): string => {
  //const value = process.env[name];
  //if (!value && !defaultValue) {
    //throw new Error(`Environment variable ${name} is required`);
  //}
  //return value || defaultValue!;
//};

// new code
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];

  // If value exists → return it
  if (value) return value;

  // If default provided → use it
  if (defaultValue) {
    console.warn(`⚠️ Missing env: ${name}, using default: ${defaultValue}`);
    return defaultValue;
  }

  // Otherwise fallback
  console.warn(`⚠️ Missing env: ${name}, using fallback`);
  return "test";
}

// new end

// API Response helpers
export const createResponse = (
  statusCode: number,
  body: any,
  headers: Record<string, string> = {}
): APIGatewayResponse => {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

export const createSuccessResponse = (data: any, statusCode: number = 200): APIGatewayResponse => {
  return createResponse(statusCode, { success: true, data });
};

export const createErrorResponse = (
  error: string | APIError,
  statusCode: number = 400
): APIGatewayResponse => {
  const errorBody = typeof error === 'string' 
    ? { success: false, error: { message: error, timestamp: new Date().toISOString() } }
    : { success: false, error };
  
  return createResponse(statusCode, errorBody);
};

// Input validation helpers
export const validateRequired = (obj: any, fields: string[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  for (const field of fields) {
    if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Field '${field}' is required`,
        field,
        value: obj[field],
        constraint: 'required',
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  return errors;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateContentLength = (content: string, maxLength: number = 500): boolean => {
  return Boolean(content && content.length <= maxLength);
};

export const validatePlatform = (platform: string): boolean => {
  const validPlatforms = ['blog', 'twitter', 'facebook', 'instagram', 'linkedin', 'youtube', 'tiktok'];
  return validPlatforms.includes(platform);
};

export const validateContentType = (contentType: string): boolean => {
  const validTypes = ['blog-post', 'social-post', 'caption', 'script', 'email', 'ad-copy'];
  return validTypes.includes(contentType);
};

export const validateContentIntent = (intent: string): boolean => {
  const validIntents = ['informational', 'promotional', 'educational', 'entertainment'];
  return validIntents.includes(intent);
};

// JWT helpers
export const generateJWT = (payload: any, expiresIn: string = '1h'): string => {
  const secret = getEnvVar('JWT_SECRET', 'default-secret-change-in-production');
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

export const verifyJWT = (token: string): any => {
  const secret = getEnvVar('JWT_SECRET', 'default-secret-change-in-production');
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const validateToken = async (authHeader: string): Promise<{ isValid: boolean; userId?: string; error?: string }> => {
  try {
    if (!authHeader) {
      return { isValid: false, error: 'No authorization header provided' };
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return { isValid: false, error: 'Invalid authorization header format' };
    }

    const token = parts[1];
    const decoded = verifyJWT(token);
    
    if (!decoded.userId) {
      return { isValid: false, error: 'Token does not contain user ID' };
    }

    return { isValid: true, userId: decoded.userId };
  } catch (error) {
    return { isValid: false, error: 'Invalid or expired token' };
  }
};

export const extractTokenFromEvent = (event: APIGatewayProxyEvent): string | null => {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  
  return parts[1];
};

// ID generation
export const generateId = (prefix: string = ''): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${prefix}${prefix ? '_' : ''}${timestamp}_${randomPart}`;
};

export const generateUserId = (): string => generateId('user');
export const generateContentId = (): string => generateId('content');
export const generateIdeaId = (): string => generateId('idea');
export const generateFeedbackId = (): string => generateId('feedback');
export const generateProfileId = (): string => generateId('profile');

// Date/Time helpers
export const getCurrentTimestamp = (): string => {
  return new Date().toISOString();
};

export const isValidDateRange = (startDate: string, endDate: string): boolean => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return start <= end && start <= new Date();
};

// Content processing helpers
export const extractKeywords = (text: string): string[] => {
  // Simple keyword extraction - in production, use more sophisticated NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Remove duplicates and return top keywords
  const uniqueWords = Array.from(new Set(words));
  return uniqueWords.slice(0, 10);
};

export const calculateReadingTime = (text: string, wordsPerMinute: number = 200): number => {
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

// Platform-specific helpers
export const getPlatformConstraints = (platform: string) => {
  const constraints: Record<string, any> = {
    twitter: {
      maxLength: 280,
      hashtagLimit: 2,
      mentionLimit: 10,
    },
    facebook: {
      maxLength: 63206,
      optimalLength: 40,
      hashtagLimit: 30,
    },
    instagram: {
      maxLength: 2200,
      hashtagLimit: 30,
      optimalHashtags: 11,
    },
    linkedin: {
      maxLength: 3000,
      optimalLength: 150,
      hashtagLimit: 5,
    },
    blog: {
      minLength: 800,
      maxLength: 2000,
      optimalLength: 1200,
    },
    youtube: {
      titleMaxLength: 100,
      descriptionMaxLength: 5000,
      hashtagLimit: 15,
    },
    tiktok: {
      maxLength: 150,
      hashtagLimit: 100,
      optimalHashtags: 3,
    },
  };
  
  return constraints[platform] || {};
};

// Error handling helpers
export const handleLambdaError = (error: any): APIGatewayResponse => {
  console.error('Lambda error:', error);
  
  if (error.name === 'ValidationError') {
    return createErrorResponse(error.message, 400);
  }
  
  if (error.name === 'UnauthorizedError') {
    return createErrorResponse('Unauthorized access', 401);
  }
  
  if (error.name === 'NotFoundError') {
    return createErrorResponse('Resource not found', 404);
  }
  
  if (error.name === 'ConflictError') {
    return createErrorResponse('Resource conflict', 409);
  }
  
  if (error.name === 'RateLimitError') {
    return createErrorResponse('Rate limit exceeded', 429);
  }
  
  // Generic server error
  return createErrorResponse('Internal server error', 500);
};

// Logging helpers
export const logInfo = (message: string, data?: any): void => {
  console.log(JSON.stringify({
    level: 'INFO',
    message,
    data,
    timestamp: getCurrentTimestamp(),
  }));
};

export const logError = (message: string, error?: any): void => {
  console.error(JSON.stringify({
    level: 'ERROR',
    message,
    error: error?.message || error,
    stack: error?.stack,
    timestamp: getCurrentTimestamp(),
  }));
};

export const logWarning = (message: string, data?: any): void => {
  console.warn(JSON.stringify({
    level: 'WARNING',
    message,
    data,
    timestamp: getCurrentTimestamp(),
  }));
};

// Performance helpers
export const measureExecutionTime = async <T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<{ result: T; executionTime: number }> => {
  const startTime = Date.now();
  const result = await operation();
  const executionTime = Date.now() - startTime;
  
  logInfo(`Operation ${operationName} completed`, { executionTime });
  
  return { result, executionTime };
};

// Retry helpers
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logWarning(`Operation failed on attempt ${attempt}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError;
};

// Configuration helpers
export const getAppConfig = () => {
  return {
    aws: {
      region: getEnvVar('AWS_REGION', 'us-east-1'),
      dynamoDbTables: {
        users: getEnvVar('USERS_TABLE_NAME'),
        contentIdeas: getEnvVar('CONTENT_IDEAS_TABLE_NAME'),
        generatedContent: getEnvVar('GENERATED_CONTENT_TABLE_NAME'),
        engagementFeedback: getEnvVar('ENGAGEMENT_FEEDBACK_TABLE_NAME'),
        audienceProfiles: getEnvVar('AUDIENCE_PROFILES_TABLE_NAME'),
        learningProfiles: getEnvVar('LEARNING_PROFILES_TABLE_NAME', 'ContentFlow-LearningProfiles'),
      },
      s3Buckets: {
        contentStorage: getEnvVar('CONTENT_STORAGE_BUCKET_NAME'),
        analytics: getEnvVar('ANALYTICS_BUCKET_NAME'),
      },
      bedrock: {
        modelIds: {
          textGeneration: getEnvVar('BEDROCK_TEXT_GENERATION_MODEL', 'anthropic.claude-3-sonnet-20240229-v1:0'),
          textAnalysis: getEnvVar('BEDROCK_TEXT_ANALYSIS_MODEL', 'anthropic.claude-3-haiku-20240307-v1:0'),
        },
      },
      sageMaker: {
        executionRoleArn: getEnvVar('SAGEMAKER_EXECUTION_ROLE_ARN', 'arn:aws:iam::123456789012:role/SageMakerExecutionRole'),
      },
    },
    api: {
      corsOrigins: getEnvVar('CORS_ORIGINS', '*').split(','),
      rateLimits: {
        contentGeneration: parseInt(getEnvVar('CONTENT_GENERATION_RATE_LIMIT', '10')),
        authentication: parseInt(getEnvVar('AUTH_RATE_LIMIT', '5')),
      },
    },
    security: {
      jwtSecret: getEnvVar('JWT_SECRET'),
      jwtExpirationTime: getEnvVar('JWT_EXPIRATION_TIME', '1h'),
      passwordMinLength: parseInt(getEnvVar('PASSWORD_MIN_LENGTH', '8')),
    },
  };
};
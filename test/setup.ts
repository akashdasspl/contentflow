// Test setup file to configure mocks and environment

// Mock AWS SDK to avoid dynamic import issues
jest.mock('@aws-sdk/client-comprehend', () => ({
  ComprehendClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  DetectDominantLanguageCommand: jest.fn(),
  DetectKeyPhrasesCommand: jest.fn(),
  DetectEntitiesCommand: jest.fn(),
  DetectSentimentCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn(),
    }),
  },
  PutCommand: jest.fn(),
  GetCommand: jest.fn(),
  UpdateCommand: jest.fn(),
  DeleteCommand: jest.fn(),
  QueryCommand: jest.fn(),
  ScanCommand: jest.fn(),
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

jest.mock('@aws-sdk/client-sagemaker-runtime', () => ({
  SageMakerRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
}));

// Set up environment variables for testing
process.env.AWS_REGION = 'us-east-1';
process.env.USERS_TABLE_NAME = 'test-users-table';
process.env.CONTENT_IDEAS_TABLE_NAME = 'test-content-ideas-table';
process.env.GENERATED_CONTENT_TABLE_NAME = 'test-generated-content-table';
process.env.FEEDBACK_TABLE_NAME = 'test-feedback-table';
process.env.ENGAGEMENT_FEEDBACK_TABLE_NAME = 'test-engagement-feedback-table';
process.env.AUDIENCE_PROFILES_TABLE_NAME = 'test-audience-profiles-table';
process.env.CONTENT_BUCKET_NAME = 'test-content-bucket';
process.env.CONTENT_STORAGE_BUCKET_NAME = 'test-content-storage-bucket';
process.env.ANALYTICS_BUCKET_NAME = 'test-analytics-bucket';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.CORS_ORIGINS = 'http://localhost:3000';
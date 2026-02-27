// Property-based tests for content input validation
// **Validates: Requirements 1.1**

import fc from 'fast-check';
import { handler as submitIdeaHandler } from '../src/lambda/content/submit-idea';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { contentIdeaService } from '../src/services/database';
import { themeExtractionService } from '../src/services/theme-extraction';
import * as utils from '../src/utils';

// Mock dependencies
jest.mock('../src/services/database');
jest.mock('../src/services/theme-extraction');
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  verifyJWT: jest.fn(),
  generateIdeaId: jest.fn(),
  getCurrentTimestamp: jest.fn(),
}));

const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;
const mockThemeExtractionService = themeExtractionService as jest.Mocked<typeof themeExtractionService>;
const mockVerifyJWT = utils.verifyJWT as jest.MockedFunction<typeof utils.verifyJWT>;
const mockGenerateIdeaId = utils.generateIdeaId as jest.MockedFunction<typeof utils.generateIdeaId>;
const mockGetCurrentTimestamp = utils.getCurrentTimestamp as jest.MockedFunction<typeof utils.getCurrentTimestamp>;

/**
 * Property-based tests for content input validation
 * **Validates: Requirements 1.1**
 */
describe('Content Input Validation Properties', () => {
  const mockUserId = 'test-user-id';
  const mockIdeaId = 'test-idea-id';
  const mockTimestamp = '2024-01-01T00:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyJWT.mockReturnValue({ userId: mockUserId });
    mockGenerateIdeaId.mockReturnValue(mockIdeaId);
    mockGetCurrentTimestamp.mockReturnValue(mockTimestamp);
    mockContentIdeaService.createContentIdea.mockResolvedValue();
    mockThemeExtractionService.extractThemesAndTopics.mockResolvedValue({
      themes: ['test theme'],
      topics: ['test topic'],
      entities: [],
      keyPhrases: [],
      sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
      intent: 'informational',
      overallConfidence: 0.7,
      processingTime: 1000,
    });
    mockThemeExtractionService.updateContentIdeaWithThemes.mockResolvedValue();
  });

  const createMockEvent = (content: string): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/content/ideas',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      Authorization: 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: JSON.stringify({ content }),
    isBase64Encoded: false,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/content/ideas',
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api-id',
      stage: 'test',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/content/ideas',
      resourceId: 'test-resource-id',
      resourcePath: '/content/ideas',
      authorizer: {},
      identity: {
        sourceIp: '127.0.0.1',
        userAgent: 'test-agent',
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        user: null,
        userArn: null,
        clientCert: null,
      },
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: 1704067200000,
    },
  });

  /**
   * Property 1: Content Input Validation
   * For any text input, the system should accept inputs up to 500 characters 
   * and reject inputs exceeding this limit with appropriate error messages
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Content Input Validation', () => {
    it('should accept all valid content inputs up to 500 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid content strings (1 to 500 characters)
          fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
          async (content: string) => {
            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(201);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.content).toBe(content.trim());
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject all content inputs exceeding 500 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content strings longer than 500 characters
          fc.string({ minLength: 501, maxLength: 1000 }),
          async (content: string) => {
            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(400);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error.message).toContain('exceeds maximum length of 500 characters');
            expect(responseBody.error.constraint).toBe('maxLength:500');
            expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept content at exactly 500 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content strings of exactly 500 characters
          fc.string({ minLength: 500, maxLength: 500 }).filter(s => s.trim().length === 500),
          async (content: string) => {
            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(201);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.content).toBe(content.trim());
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject empty or whitespace-only content', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate whitespace-only strings
          fc.oneof(
            fc.constant(''),
            fc.string().filter(s => s.trim().length === 0 && s.length > 0)
          ),
          async (content: string) => {
            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(400);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error.message).toContain('Required fields are missing');
            expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle various character types and encodings correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content with various character types
          fc.oneof(
            // ASCII text
            fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
            // Unicode text with emojis
            fc.string({ minLength: 1, maxLength: 400 }).map(s => s + ' 🚀✨🎯'),
            // Mixed content with special characters
            fc.string({ minLength: 1, maxLength: 450 }).map(s => s + ' @#$%^&*()'),
            // Content with newlines and tabs
            fc.string({ minLength: 1, maxLength: 450 }).map(s => s + '\n\t'),
            // Non-English characters
            fc.string({ minLength: 1, maxLength: 400 }).map(s => s + ' 你好世界 مرحبا العالم')
          ),
          async (content: string) => {
            // Skip if content becomes too long after modification
            if (content.length > 500) return;
            
            // Skip if content becomes empty after trimming
            if (content.trim().length === 0) return;

            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(201);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.content).toBe(content.trim());
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide consistent error messages for invalid inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various invalid inputs
          fc.oneof(
            // Too long content
            fc.string({ minLength: 501, maxLength: 1000 }).map(s => ({ content: s, expectedError: 'exceeds maximum length' })),
            // Empty content
            fc.constant({ content: '', expectedError: 'Required fields are missing' }),
            // Whitespace-only content
            fc.string().filter(s => s.trim().length === 0 && s.length > 0).map(s => ({ content: s, expectedError: 'Required fields are missing' }))
          ),
          async ({ content, expectedError }: { content: string; expectedError: string }) => {
            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(400);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(false);
            expect(responseBody.error.message).toContain(expectedError);
            expect(responseBody.error.code).toBe('VALIDATION_ERROR');
            expect(responseBody.error.timestamp).toBeDefined();
            expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should trim whitespace consistently for all valid inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content with leading/trailing whitespace
          fc.string({ minLength: 1, maxLength: 490 }).filter(s => s.trim().length > 0),
          fc.string({ maxLength: 5 }).filter(s => /^\s*$/.test(s)), // Leading whitespace
          fc.string({ maxLength: 5 }).filter(s => /^\s*$/.test(s)), // Trailing whitespace
          async (coreContent: string, leadingWs: string, trailingWs: string) => {
            const content = leadingWs + coreContent + trailingWs;
            
            // Skip if total length exceeds 500 characters
            if (content.length > 500) return;

            // Arrange
            const event = createMockEvent(content);

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            expect(result.statusCode).toBe(201);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            expect(responseBody.data.content).toBe(content.trim());
            expect(responseBody.data.content).toBe(coreContent.trim());
            expect(mockContentIdeaService.createContentIdea).toHaveBeenCalledWith(
              expect.objectContaining({
                content: content.trim()
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate content length after trimming', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content that might be valid after trimming
          fc.oneof(
            // Content that becomes valid after adding whitespace
            fc.string({ minLength: 1, maxLength: 498 }).filter(s => s.trim().length > 0).map(s => '  ' + s + '  '), // Should be valid
            // Content that becomes empty after trimming
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\s+$/.test(s)) // Should be invalid
          ),
          async (content: string) => {
            // Reset mocks for each property test run
            jest.clearAllMocks();
            mockVerifyJWT.mockReturnValue({ userId: mockUserId });
            mockGenerateIdeaId.mockReturnValue(mockIdeaId);
            mockGetCurrentTimestamp.mockReturnValue(mockTimestamp);
            mockContentIdeaService.createContentIdea.mockResolvedValue();
            mockThemeExtractionService.extractThemesAndTopics.mockResolvedValue({
              themes: ['test theme'],
              topics: ['test topic'],
              entities: [],
              keyPhrases: [],
              sentiment: { sentiment: 'NEUTRAL', confidence: 0.5 },
              intent: 'informational',
              overallConfidence: 0.7,
              processingTime: 1000,
            });
            mockThemeExtractionService.updateContentIdeaWithThemes.mockResolvedValue();

            // Arrange
            const event = createMockEvent(content);
            const trimmedLength = content.trim().length;

            // Act
            const result = await submitIdeaHandler(event);

            // Assert
            if (trimmedLength === 0) {
              // Should be rejected for being empty after trimming
              expect(result.statusCode).toBe(400);
              const responseBody = JSON.parse(result.body);
              expect(responseBody.success).toBe(false);
              expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
            } else if (trimmedLength <= 500) {
              // Should be accepted
              expect(result.statusCode).toBe(201);
              const responseBody = JSON.parse(result.body);
              expect(responseBody.success).toBe(true);
              expect(responseBody.data.content).toBe(content.trim());
              expect(mockContentIdeaService.createContentIdea).toHaveBeenCalled();
            } else {
              // Should be rejected for being too long
              expect(result.statusCode).toBe(400);
              const responseBody = JSON.parse(result.body);
              expect(responseBody.success).toBe(false);
              expect(responseBody.error.message).toContain('exceeds maximum length');
              expect(mockContentIdeaService.createContentIdea).not.toHaveBeenCalled();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
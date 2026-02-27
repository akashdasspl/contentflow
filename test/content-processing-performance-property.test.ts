// Property-based tests for content processing performance
// **Validates: Requirements 1.2**

import fc from 'fast-check';
import { themeExtractionService, ThemeExtractionService } from '../src/services/theme-extraction';
import { handler as extractThemesHandler } from '../src/lambda/content/extract-themes';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { contentIdeaService } from '../src/services/database';
import * as utils from '../src/utils';

// Mock dependencies
jest.mock('../src/services/database');
jest.mock('../src/services/aws-clients', () => ({
  comprehendClient: {
    send: jest.fn(),
  },
}));
jest.mock('../src/utils', () => ({
  ...jest.requireActual('../src/utils'),
  verifyJWT: jest.fn(),
  measureExecutionTime: jest.fn(),
}));

const mockContentIdeaService = contentIdeaService as jest.Mocked<typeof contentIdeaService>;
const mockVerifyJWT = utils.verifyJWT as jest.MockedFunction<typeof utils.verifyJWT>;
const mockMeasureExecutionTime = utils.measureExecutionTime as jest.MockedFunction<typeof utils.measureExecutionTime>;

/**
 * Property-based tests for content processing performance
 * **Validates: Requirements 1.2**
 */
describe('Content Processing Performance Properties', () => {
  let service: ThemeExtractionService;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ThemeExtractionService();
    mockVerifyJWT.mockReturnValue({ userId: mockUserId });
    
    // Mock AWS Comprehend responses
    const { comprehendClient } = require('../src/services/aws-clients');
    comprehendClient.send
      .mockResolvedValueOnce({ Languages: [{ LanguageCode: 'en', Score: 0.99 }] })
      .mockResolvedValueOnce({
        KeyPhrases: [
          { Text: 'artificial intelligence', Score: 0.95 },
          { Text: 'machine learning', Score: 0.88 },
        ],
      })
      .mockResolvedValueOnce({
        Entities: [
          { Text: 'Python', Type: 'OTHER', Score: 0.92 },
        ],
      })
      .mockResolvedValueOnce({
        Sentiment: 'POSITIVE',
        SentimentScore: { Positive: 0.85, Negative: 0.05, Neutral: 0.08, Mixed: 0.02 },
      });

    // Mock measureExecutionTime to return actual execution time
    mockMeasureExecutionTime.mockImplementation(async (fn: () => Promise<any>) => {
      const startTime = Date.now();
      const result = await fn();
      const executionTime = Date.now() - startTime;
      return { result, executionTime };
    });
  });

  const createMockEvent = (text: string): APIGatewayProxyEvent => ({
    httpMethod: 'POST',
    path: '/content/extract-themes',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      Authorization: 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    body: JSON.stringify({ text }),
    isBase64Encoded: false,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: '/content/extract-themes',
    requestContext: {
      requestId: 'test-request-id',
      accountId: '123456789012',
      apiId: 'test-api-id',
      stage: 'test',
      protocol: 'HTTP/1.1',
      httpMethod: 'POST',
      path: '/content/extract-themes',
      resourceId: 'test-resource-id',
      resourcePath: '/content/extract-themes',
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
   * Property 2: Content Processing Performance
   * For any valid content idea, the system should extract key themes and topics within 5 seconds
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Content Processing Performance', () => {
    it('should extract themes within 5 seconds for any valid content', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate various types of content
          fc.oneof(
            // Short content
            fc.string({ minLength: 10, maxLength: 100 }),
            // Medium content
            fc.string({ minLength: 100, maxLength: 500 }),
            // Long content (up to service limit)
            fc.string({ minLength: 500, maxLength: 1000 }),
            // Content with technical terms
            fc.constantFrom(
              'artificial intelligence machine learning deep learning neural networks',
              'cloud computing AWS Lambda serverless architecture microservices',
              'data science analytics big data visualization dashboard reporting',
              'web development React TypeScript JavaScript frontend backend',
              'mobile app development iOS Android React Native Flutter'
            ),
            // Content with mixed languages and special characters
            fc.string({ minLength: 50, maxLength: 300 }).map(s => s + ' 🚀 AI/ML @tech #innovation')
          ).filter(text => text.trim().length > 0),
          async (text: string) => {
            // Arrange
            const startTime = Date.now();

            // Act
            const result = await service.extractThemesAndTopics(text);
            const endTime = Date.now();
            const actualProcessingTime = endTime - startTime;

            // Assert - Processing time should be within 5 seconds (5000ms)
            expect(actualProcessingTime).toBeLessThan(5000);
            expect(result.processingTime).toBeLessThan(5000);
            
            // Verify result structure is complete
            expect(result.themes).toBeInstanceOf(Array);
            expect(result.topics).toBeInstanceOf(Array);
            expect(result.entities).toBeInstanceOf(Array);
            expect(result.keyPhrases).toBeInstanceOf(Array);
            expect(result.sentiment).toBeDefined();
            expect(result.intent).toBeDefined();
            expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
            expect(result.overallConfidence).toBeLessThanOrEqual(1);
            expect(result.processingTime).toBeGreaterThan(0);
          }
        ),
        { numRuns: 50, timeout: 10000 } // 10 second timeout for property test
      );
    });

    it('should maintain performance consistency across different content lengths', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content of varying lengths
          fc.integer({ min: 10, max: 1000 }),
          fc.string({ minLength: 1, maxLength: 1 }),
          async (length: number, baseChar: string) => {
            // Create content of specific length
            const text = baseChar.repeat(Math.max(10, length)) + ' artificial intelligence content';
            
            // Arrange
            const startTime = Date.now();

            // Act
            const result = await service.extractThemesAndTopics(text);
            const endTime = Date.now();
            const actualProcessingTime = endTime - startTime;

            // Assert - Performance should not degrade significantly with length
            expect(actualProcessingTime).toBeLessThan(5000);
            expect(result.processingTime).toBeLessThan(5000);
            
            // Processing time should be reasonable relative to content length
            const timePerCharacter = actualProcessingTime / text.length;
            expect(timePerCharacter).toBeLessThan(10); // Less than 10ms per character
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    it('should handle concurrent processing requests within time limits', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple content pieces for concurrent processing
          fc.array(
            fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0),
            { minLength: 2, maxLength: 5 }
          ),
          async (contentArray: string[]) => {
            // Arrange
            const startTime = Date.now();

            // Act - Process all content pieces concurrently
            const promises = contentArray.map(text => service.extractThemesAndTopics(text));
            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalProcessingTime = endTime - startTime;

            // Assert - All individual results should meet time requirements
            results.forEach(result => {
              expect(result.processingTime).toBeLessThan(5000);
              expect(result.themes).toBeInstanceOf(Array);
              expect(result.topics).toBeInstanceOf(Array);
              expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
            });

            // Total concurrent processing should be efficient
            const averageTimePerRequest = totalProcessingTime / contentArray.length;
            expect(averageTimePerRequest).toBeLessThan(5000);
          }
        ),
        { numRuns: 20, timeout: 15000 }
      );
    });

    it('should extract themes efficiently through Lambda handler', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content for Lambda handler testing
          fc.string({ minLength: 20, maxLength: 400 }).filter(s => s.trim().length > 0),
          async (text: string) => {
            // Arrange
            const event = createMockEvent(text);
            const startTime = Date.now();

            // Act
            const result = await extractThemesHandler(event);
            const endTime = Date.now();
            const totalHandlerTime = endTime - startTime;

            // Assert
            expect(result.statusCode).toBe(200);
            const responseBody = JSON.parse(result.body);
            expect(responseBody.success).toBe(true);
            
            // Handler should complete within reasonable time (including overhead)
            expect(totalHandlerTime).toBeLessThan(7000); // 7 seconds including Lambda overhead
            
            // Processing time reported in response should meet requirement
            expect(responseBody.data.processingTime).toBeLessThan(5000);
            
            // Verify complete response structure
            expect(responseBody.data.themes).toBeInstanceOf(Array);
            expect(responseBody.data.topics).toBeInstanceOf(Array);
            expect(responseBody.data.confidence).toBeGreaterThanOrEqual(0);
            expect(responseBody.data.confidence).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 30, timeout: 10000 }
      );
    });

    it('should maintain performance under various content complexities', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate content with different complexity characteristics
          fc.oneof(
            // Simple repetitive content
            fc.constantFrom('simple', 'basic', 'easy').chain(word => 
              fc.integer({ min: 5, max: 20 }).map(count => 
                Array(count).fill(word + ' content').join(' ')
              )
            ),
            // Complex technical content
            fc.constantFrom(
              'machine learning algorithms neural networks deep learning artificial intelligence',
              'cloud computing serverless architecture microservices containerization kubernetes',
              'data science analytics visualization dashboard reporting business intelligence',
              'blockchain cryptocurrency decentralized finance smart contracts web3 technology'
            ),
            // Mixed complexity content
            fc.string({ minLength: 50, maxLength: 300 }).map(s => 
              s + ' with technical terms like AI, ML, API, SDK, and frameworks'
            )
          ),
          async (text: string) => {
            // Skip empty content
            if (text.trim().length === 0) return;

            // Arrange
            const startTime = Date.now();

            // Act
            const result = await service.extractThemesAndTopics(text);
            const endTime = Date.now();
            const actualProcessingTime = endTime - startTime;

            // Assert - Performance should be consistent regardless of complexity
            expect(actualProcessingTime).toBeLessThan(5000);
            expect(result.processingTime).toBeLessThan(5000);
            
            // Results should be proportional to content complexity
            if (text.includes('machine learning') || text.includes('artificial intelligence')) {
              // Technical content should extract relevant themes
              expect(result.themes.length).toBeGreaterThan(0);
            }
            
            // All results should have valid confidence scores
            expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
            expect(result.overallConfidence).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 40, timeout: 10000 }
      );
    });

    it('should handle edge cases within performance requirements', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate edge case content
          fc.oneof(
            // Very short content
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
            // Content with only special characters and numbers
            fc.string().filter(s => /^[^a-zA-Z]*$/.test(s) && s.trim().length > 0),
            // Content with excessive whitespace
            fc.string({ minLength: 10, maxLength: 100 }).map(s => '   ' + s + '   '),
            // Content with repeated patterns
            fc.string({ minLength: 5, maxLength: 20 }).chain(pattern =>
              fc.integer({ min: 2, max: 10 }).map(count =>
                Array(count).fill(pattern).join(' ')
              )
            )
          ),
          async (text: string) => {
            // Skip truly empty content
            if (text.trim().length === 0) return;

            // Arrange
            const startTime = Date.now();

            // Act
            const result = await service.extractThemesAndTopics(text);
            const endTime = Date.now();
            const actualProcessingTime = endTime - startTime;

            // Assert - Even edge cases should meet performance requirements
            expect(actualProcessingTime).toBeLessThan(5000);
            expect(result.processingTime).toBeLessThan(5000);
            
            // Results should be valid even for edge cases
            expect(result.themes).toBeInstanceOf(Array);
            expect(result.topics).toBeInstanceOf(Array);
            expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
            expect(result.overallConfidence).toBeLessThanOrEqual(1);
            expect(Number.isFinite(result.processingTime)).toBe(true);
          }
        ),
        { numRuns: 30, timeout: 8000 }
      );
    });

    it('should provide consistent timing measurements', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate consistent content for timing comparison
          fc.constantFrom(
            'This is a test content about artificial intelligence and machine learning.',
            'Cloud computing and serverless architecture are transforming software development.',
            'Data science involves analytics, visualization, and statistical modeling techniques.'
          ),
          async (text: string) => {
            // Arrange - Run the same content multiple times
            const results: number[] = [];

            // Act - Measure processing time multiple times
            for (let i = 0; i < 3; i++) {
              const startTime = Date.now();
              const result = await service.extractThemesAndTopics(text);
              const endTime = Date.now();
              const processingTime = endTime - startTime;
              
              results.push(processingTime);
              
              // Each individual run should meet requirements
              expect(processingTime).toBeLessThan(5000);
              expect(result.processingTime).toBeLessThan(5000);
            }

            // Assert - Timing should be relatively consistent
            const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
            const maxDeviation = Math.max(...results.map(t => Math.abs(t - avgTime)));
            
            // Deviation should not be excessive (within 2 seconds of average)
            expect(maxDeviation).toBeLessThan(2000);
            expect(avgTime).toBeLessThan(5000);
          }
        ),
        { numRuns: 10, timeout: 20000 }
      );
    });
  });
});